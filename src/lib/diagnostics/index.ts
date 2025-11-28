
import { ChartablePoint, AnalysisPeriod } from '../placeholder-data';
import { extractFeatures, HydrographFeatures } from './feature-extractor';
import { runRulesEngine, DiagnosticResult } from './rules-engine';

export interface DiagnosticsInput {
    allData: ChartablePoint[];
    events: AnalysisPeriod[];
    permanentPoolElevation: number;
    designDrawdown: number; // in hours
}

export interface DiagnosticsOutput {
    [eventId: string]: DiagnosticResult[];
}

export function runDiagnostics(input: DiagnosticsInput): DiagnosticsOutput {
    const output: DiagnosticsOutput = {};

    for (const event of input.events) {
        if (event.analysis?.disregarded) {
            continue;
        }

        const features: HydrographFeatures = extractFeatures(event, input.allData, input.permanentPoolElevation, input.designDrawdown);
        const diagnoses: DiagnosticResult[] = runRulesEngine(features);

        output[event.id] = diagnoses;
    }

    return output;
}
