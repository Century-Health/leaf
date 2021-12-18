/* Copyright (c) 2022, UW Medicine Research IT, University of Washington
 * Developed by Nic Dobbins and Cliff Spital, CRIO Sean Mooney
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */ 

import { CancelTokenSource } from 'axios';
import { AppState } from '../models/state/AppState';
import { HttpFactory } from './HttpFactory';
import moment from 'moment'

/**
 * Fetch a dataset, which may or may not have date boundaries.
 */
export const fetchDataset = async (
        state: AppState, 
        queryId: string, 
        dataset: PatientListDatasetQuery, 
        dates?: DateBoundary,
        panelIndex?: number
    ): Promise<PatientListDatasetDTO> => {

    const { token } = state.session.context!;
    const http = HttpFactory.authenticated(token);
    const params: any = {
        datasetid: dataset.id,
        shape: dataset.shape
    }
    if (typeof panelIndex !== 'undefined') {
        params.panelIdx = panelIndex
    } else if (dates && dates.start.dateIncrementType !== DateIncrementType.NONE && dates.end.dateIncrementType !== DateIncrementType.NONE) {
        params.early = deriveDateTicks(dates.start);
        params.late = deriveDateTicks(dates.end);
    }

    const result = await http.get(`/api/cohort/${queryId}/dataset`, { params });
    return result.data as PatientListDatasetDTO
};

/**
 * Private method for getting UNIX ticks based on a given
 * DateFilter. Used when requesting datasets.
 */
const deriveDateTicks = (date: DateFilter): number => {
    const dateTypeKeyMap = new Map([
        [DateIncrementType.HOUR, 'h'],
        [DateIncrementType.DAY, 'd'],
        [DateIncrementType.WEEK, 'w'],
        [DateIncrementType.MONTH, 'M'],
        [DateIncrementType.YEAR, 'y']
    ]);

    if (date.dateIncrementType === DateIncrementType.NOW) {
        return Math.round(new Date().getTime() / 1000);
    }
    else if (date.dateIncrementType === DateIncrementType.SPECIFIC && date.date) {
        return Math.round(new Date(date.date!).getTime() / 1000);
    }
    else {
        const momentIncrementType = dateTypeKeyMap.get(date.dateIncrementType)!;
        const incr = date.increment as any;
        return Math.round(moment().add(incr, momentIncrementType).toDate().getTime() / 1000);
    }
};