
/**
 * Types
 */
export type WidgetIdType =  "row" | "checklist" | "list" | "timeline";

export type WidgetType = 
    WidgetRowConfig  | WidgetChecklistConfig |
    WidgetListConfig | WidgetTimelineConfig;

export type RgbValues = [ number, number, number ];

export type Icons = "checklist" | "plus" | "med";

/**
 * Abstract config type
 */
interface BaseWidgetConfig {
    type: WidgetIdType;
};

interface TitledWidgetConfig extends BaseWidgetConfig {
    title: string;
}

interface StyledWidgetConfig extends TitledWidgetConfig {
    color?: RgbValues;
    icon?: Icons;
    width?: number;
};

/**
 * Row
 */
export interface WidgetRowConfig extends BaseWidgetConfig {
    content: (WidgetChecklistConfig | WidgetListConfig | WidgetTimelineConfig)[];
};

/**
 * List
 */
export interface WidgetListConfig extends StyledWidgetConfig {
    datasetId: string;
};

/**
 * Checklist
 */
export interface WidgetChecklistConfig extends StyledWidgetConfig {
    datasets: ContentChecklistDatasetConfig[];
};

export interface ContentChecklistDatasetConfig {
    id: string;
    items: string[];
    title: string;
};

/**
 * Timeline
 */
 export interface WidgetTimelineConfig extends TitledWidgetConfig {
    comparison: WidgetTimelineComparisonConfig;
    datasets: WidgetTimelineDatasetConfig[];
    export: WidgetTimelineExportConfig;
};

export interface WidgetTimelineDatasetConfig {
    id: string;
    title: string;
};

interface WidgetTimelineExportConfig {
    enabled: boolean;
};

interface WidgetTimelineComparisonConfig {
    columnText: string;
    enabled: boolean;
    title: string;
};