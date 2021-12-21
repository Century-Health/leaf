/* Copyright (c) 2022, UW Medicine Research IT, University of Washington
 * Developed by Nic Dobbins and Cliff Spital, CRIO Sean Mooney
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { CohortData } from "../cohortData/cohortData";
import { PatientData } from "../patientData/patientData";

export enum CohortStateType {
    REQUESTING = 1,
    NOT_LOADED = 2,
    LOADED = 3,
    IN_ERROR = 4,
    NOT_IMPLEMENTED = 5
};

export interface CohortState {
    cohort: CohortData;
    patient: PatientData;
};
