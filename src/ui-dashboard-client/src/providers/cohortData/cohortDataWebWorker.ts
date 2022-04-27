/* Copyright (c) 2022, UW Medicine Research IT, University of Washington
 * Developed by Nic Dobbins and Cliff Spital, CRIO Sean Mooney
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */ 

import { generate as generateId } from 'shortid';
import { PatientListDatasetDTO, PatientListDatasetQueryDTO } from '../../models/patientList/Dataset';
import { workerContext } from './cohortDataWebWorkerContext';
import { personId, encounterId } from '../../models/patientList/DatasetDefinitionTemplate';
import { PatientListColumnType } from '../../models/patientList/Column';
import { DemographicRow } from '../../models/cohortData/DemographicDTO';
import { CohortData, DatasetMetadata, PatientData } from '../../models/state/CohortState';
import { WidgetTimelineComparisonEntryConfig } from '../../models/config/content';
import { resourceLimits } from 'worker_threads';

const TRANSFORM = 'TRANSFORM';
const GET_COHORT_MEAN = 'GET_COHORT_MEAN';

const typeString = PatientListColumnType.String;
const typeNum = PatientListColumnType.Numeric;
const typeDate = PatientListColumnType.DateTime;
const typeSparkline = PatientListColumnType.Sparkline;

interface InboundMessagePartialPayload {
    data?: [PatientListDatasetQueryDTO, PatientListDatasetDTO];
    dimensions?: WidgetTimelineComparisonEntryConfig[];
    demographics?: DemographicRow[];
    sourcePatId?: string;
    message: string;
}

interface InboundMessagePayload extends InboundMessagePartialPayload {
    requestId: string;
}

interface OutboundMessagePayload {
    requestId: string;
    result?: any;
}

interface WorkerReturnPayload {
    data: OutboundMessagePayload;
}

interface PromiseResolver {
    reject: any;
    resolve: any;
}

export default class CohortDataWebWorker {
    private worker: Worker;
    private reject: any;
    private promiseMap: Map<string, PromiseResolver> = new Map();

    constructor() {
        const workerFile = `  
            ${this.addMessageTypesToContext([ TRANSFORM, GET_COHORT_MEAN ])}
            var typeString = ${PatientListColumnType.String};
            var typeNum = ${PatientListColumnType.Numeric};
            var typeDate = ${PatientListColumnType.DateTime};
            var typeSparkline = ${PatientListColumnType.Sparkline};
            var personId = '${personId}';
            var encounterId = '${encounterId}';
            ${/* workerContext */ this.stripFunctionToContext(this.workerContext)}
            self.onmessage = function(e) {  
                self.postMessage(handleWorkMessage.call(this, e.data, postMessage)); 
            }`;
        // console.log(workerFile);
        const blob = new Blob([workerFile], { type: 'text/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));
        this.worker.onmessage = result => this.handleReturnPayload(result);
        this.worker.onerror = error => this.reject(error);
    }

    public transform = (data: [PatientListDatasetQueryDTO, PatientListDatasetDTO], demographics: DemographicRow[]) => {
        return this.postMessage({ message: TRANSFORM, data, demographics });
    }

    public getCohortMean = (dimensions: WidgetTimelineComparisonEntryConfig[], sourcePatId: string) => {
        return this.postMessage({ message: GET_COHORT_MEAN, dimensions, sourcePatId });
    }

    private postMessage = (payload: InboundMessagePartialPayload) => {
        return new Promise((resolve, reject) => {
            const requestId = generateId();
            this.reject = reject;
            this.promiseMap.set(requestId, { resolve, reject });
            this.worker.postMessage({ ...payload, requestId });
        })
    }

    private handleReturnPayload = (payload: WorkerReturnPayload): any => {
        const data = payload.data.result ? payload.data.result : {}
        const resolve = this.promiseMap.get(payload.data.requestId)!.resolve;
        this.promiseMap.delete(payload.data.requestId);
        return resolve(data);
    }

    private stripFunctionToContext = (f: () => any) => {
        const funcString = `${f}`;
        return funcString
            .substring(0, funcString.lastIndexOf('}'))
            .substring(funcString.indexOf('{') + 1)
    }

    private addMessageTypesToContext = (messageTypes: string[]) => {
        return messageTypes.map((v: string) => `var ${v} = '${v}';`).join(' ');
    }

    private workerContext = () => {

        // eslint-disable-next-line
        const handleWorkMessage = (payload: InboundMessagePayload) => {
            switch (payload.message) {
                case TRANSFORM:
                    return transform(payload);
                case GET_COHORT_MEAN:
                    return getCohortMean(payload);
                default:
                    return null;
            }
        };

        let cohortData: CohortData = { patients: new Map(), metadata: new Map(), comparison: new Map() };
        let datasets: Map<string, [PatientListDatasetQueryDTO, PatientListDatasetDTO]>;

        const getCohortMean = (payload: InboundMessagePayload): OutboundMessagePayload => {
            const { dimensions, sourcePatId, requestId } = payload;
            const result: Map<string, Map<string, number>> = new Map();
            const matches = getMatchingPatients(dimensions!, sourcePatId!);

            for (const dim of dimensions!) {
                const mean = getMeanValue(matches, dim);
                if (result.has(dim.datasetId)) {
                    result.get(dim.datasetId)!.set(dim.column, mean);
                } else {
                    result.set(dim.datasetId, new Map([[ dim.column, mean ]]));
                }
            }

            return { result, requestId };
        };

        const getMeanValue = (patIds: string[], dim: WidgetTimelineComparisonEntryConfig): number => {
            let n = 0;
            let sum = 0.0;
            for (const p of patIds) {
                const d = cohortData.patients.get(p)!;
                const ds = d.datasets.get(dim.datasetId);
                if (ds) {
                    const vals = ds.filter(x => x[dim.column]);
                    if (vals.length) {
                        n++;
                        sum += vals[-1] as any;
                    }
                }
            }

            return sum / n;
        };

        const getMatchingPatients = (dimensions: WidgetTimelineComparisonEntryConfig[], sourcePatId: string): string[] => {
            const matched: Set<string> = new Set();
            const elig = new Map(cohortData.patients);
            const sourcePat = cohortData.patients.get(sourcePatId);
            const all = () => [ ...cohortData.patients.keys() ];

            if (!sourcePat) return all();
            for (const dim of dimensions) {
                
                // Check dataset
                const ds = datasets.get(dim.datasetId);
                if (!ds) return all();

                // Check column
                const col = ds[1].schema.fields.find(f => f.name === dim.column);
                if (!col) return all();

                // Get matching func
                const matcher = (col.type === typeNum
                    ? matchNum : matchString)(dim, sourcePat);

                // Check each patient
                for (const pat of elig) {
                    const matched = matcher(pat[1]);
                    if (!matched) {
                        elig.delete(pat[0]);
                    }
                }
            }

            return [ ...matched.keys() ];
        };

        const matchString = (dim: WidgetTimelineComparisonEntryConfig, sourcePat: PatientData) => {
            const defaultMatchFunc = (pat: PatientData) => true;
            let matchOn = new Set();
            let matchUnq = 1;

            if (dim.args && dim.args.string && dim.args.string.matchOn && dim.args.string.matchOn.length > 0) {
                matchOn = new Set(dim.args.string.matchOn);
                matchUnq = matchOn.size;
            } else {
                const ds = sourcePat.datasets.get(dim.datasetId);
                if (!ds) return defaultMatchFunc;

                const val = ds.find(r => r[dim.column]);
                if (!val) return defaultMatchFunc;

                matchOn = new Set([ val[dim.column] ]);
            }

            return (pat: PatientData): boolean => {
                const ds = pat.datasets.get(dim.datasetId);
                if (!ds) return false;

                const vals = ds.filter(r => matchOn.has(r[dim.column])).map(r => r[dim.column]);
                if (vals.length === 0) return false;

                const unq = new Set(vals).size;
                if (unq === matchUnq) return true;
                return false;
            }
        };

        const matchNum = (dim: WidgetTimelineComparisonEntryConfig, sourcePat: PatientData) => {
            const defaultMatchFunc = (pat: PatientData) => true;

            const ds = sourcePat.datasets.get(dim.datasetId);
            if (!ds) return defaultMatchFunc;

            const val = ds.find(r => r[dim.column]);
            if (!val) return defaultMatchFunc;

            let boundLow = val[dim.column] as any;
            let boundHigh = boundLow;

            if (dim.args && dim.args.numeric && dim.args.numeric.pad) {
                boundLow -= dim.args.numeric.pad;
                boundHigh += dim.args.numeric.pad;
            }

            return (pat: PatientData): boolean => {
                const ds = pat.datasets.get(dim.datasetId);
                if (!ds) return false;

                const val = ds.find(r => r[dim.column] as any >= boundLow && r[dim.column] as any <= boundHigh);
                if (!val) return false;
                return true;
            }
        };

        const transform = (payload: InboundMessagePayload): OutboundMessagePayload => {
            const { data, demographics, requestId } = payload;
            let cohortData = { patients: new Map(), metadata: new Map() };
            datasets = new Map();

            for (const row of demographics!) {
                cohortData.patients.set(row.personId, { demographics: row, datasets: new Map() });
            };

            for (const pair of data!) {
                const [ dsRef, dataset ] = pair as any;
                const meta: DatasetMetadata = { ref: dsRef, schema: dataset.schema };
                const dateFields = dataset.schema.fields.filter((field: any) => field.type === typeDate).map((field: any) => field.name);
                datasets.set(dsRef.id, [ dsRef, dataset ]);

                for (const patientId of Object.keys(dataset.results)) {
                    let rows = dataset.results[patientId];
                    let patient = cohortData.patients.get(patientId)!;

                    // Convert strings to dates
                    for (let j = 0; j < rows.length; j++) {
                        const row = rows[j] as any;
                        for (let k = 0; k < dateFields.length; k++) {
                            const f = dateFields[k];
                            const v = row[f];
                            if (v) {
                                row[f] = parseTimestamp(v);
                                row.__dateunix__ = row[f].valueOf();
                            }
                        }
                    }
                    rows = rows.sort(((a: any, b: any) => a.__dateunix__ - b.__dateunix__));
                    patient.datasets.set(dsRef.id, rows);
                    patient.datasets.set("demographics", [ patient.demographics ]);
                    cohortData.patients.set(patientId, patient);
                    cohortData.metadata.set(dsRef.id, meta);
                }
            }

            return { result: cohortData, requestId };
        }

        /**
         * Parse a string timestamp. More info at https://github.com/uwrit/leaf/issues/418
         */
         const parseTimestamp = (timestampStr: string): Date => {
            const _date = new Date(timestampStr);
            return new Date(_date.getTime() + (_date.getTimezoneOffset() * 60 * 1000));
        };
    }
}

