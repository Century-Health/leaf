import { DashboardConfig } from "../models/config/config";

export const config: DashboardConfig = 
{
    main: {
        title: "UW Memory and Brain Wellness Dashboard",
        cohortId: "d3f1423e-f36b-1410-81bf-0018c8508655",
        datasetIds: [
            "d6f1423e-f36b-1410-81bf-0018c8508655",
            "d9f1423e-f36b-1410-81bf-0018c8508655",
            "e0f1423e-f36b-1410-81bf-0018c8508655",
            "e3f1423e-f36b-1410-81bf-0018c8508655",
            "e6f1423e-f36b-1410-81bf-0018c8508655",
            "ebf1423e-f36b-1410-81bf-0018c8508655",
            "f0f1423e-f36b-1410-81bf-0018c8508655",
            "f2f1423e-f36b-1410-81bf-0018c8508655",
            "f4f1423e-f36b-1410-81bf-0018c8508655"
        ],
        content: []
    },
    patient: {
        title: "Memory and Brain Wellness Dashboard",
        search: {
            enabled: true
        },
        content: [
            {
                type: "row",
                content: [
                    {
                        color: [143, 31, 177],
                        icon: "checklist",
                        type: "checklist",
                        title: "Quality Care Checklists",
                        width: 5,
                        datasets: [
                            {
                                title: "MBWC Quality Measures",
                                id: "f0f1423e-f36b-1410-81bf-0018c8508655",
                                fieldValues: "obs_value_str",
                                items: [
                                    "MRI Brain","FDG PET Brain","CSF","Hearing Screening","Vision Screening","Family Conference","Neuropsychology","MoCA","MMSE","In MBWC Program"
                                ]
                            }
                        ]
                        
                    },
                    {
                        color: [35, 122, 35],
                        icon: "plus",
                        type: "list",
                        title: "Problem List",
                        width: 4,
                        datasetId: "f2f1423e-f36b-1410-81bf-0018c8508655",
                        fieldName: "prob_name",
                        fieldDate: "prob_date"
                    },
                    {
                        color: [36, 77, 138],
                        icon: "med",
                        type: "list",
                        title: "Active Medications",
                        width: 3,
                        datasetId: "f4f1423e-f36b-1410-81bf-0018c8508655",
                        fieldName: "med_name",
                        fieldDate: "med_date"
                    }
                ]
            },
            {
                type: "timeline",
                title: "Clinical Course Timeline",
                export: {
                    enabled: true
                },
                datasets: [
                    {
                        title: "Body weight (lbs)",
                        id: "d6f1423e-f36b-1410-81bf-0018c8508655"
                    },
                    {
                        title: "PHQ9 score",
                        id: "d9f1423e-f36b-1410-81bf-0018c8508655"
                    },
                    {
                        title: "MoCA score",
                        id: "e0f1423e-f36b-1410-81bf-0018c8508655"
                    },
                    {
                        title: "NPI Severity",
                        id: "e3f1423e-f36b-1410-81bf-0018c8508655"
                    },
                    {
                        title: "# Intact iADLs",
                        id: "e6f1423e-f36b-1410-81bf-0018c8508655"
                    },
                    {
                        title: "Latest Social / Health Change",
                        id: "ebf1423e-f36b-1410-81bf-0018c8508655"
                    }
                ]
            }
        ]
    }
}