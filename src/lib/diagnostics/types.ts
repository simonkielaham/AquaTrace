
import { ChartablePoint, AnalysisPeriod } from '../placeholder-data';

export interface DiagnosticsInput {
    allData: ChartablePoint[];
    events: AnalysisPeriod[];
    permanentPoolElevation: number;
    designDrawdown: number;
}

export interface DiagnosticsOutput {
    [eventId: string]: {
        diagnoses: {
            issue: string;
            confidence: number;
            investigation: string;
        }[];
    };
}
