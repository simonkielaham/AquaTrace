
import { HydrographFeatures } from './feature-extractor';
import { rules, DiagnosticRule } from './ruleset';

export interface DiagnosticResult {
    ruleId: string;
    title: string;
    confidence: number;
    investigation: string;
}

export function runRulesEngine(features: HydrographFeatures): DiagnosticResult[] {
    const diagnoses: DiagnosticResult[] = [];

    rules.forEach(rule => {
        let confidence = 0;
        let conditionsMet = 0;
        let conditionsCount = rule.conditions.length;

        rule.conditions.forEach(condition => {
            let isMet = false;
            switch(condition.feature) {
                case 'drawdownIsSteep':
                    if (features.drawdownIsSteep === condition.value) isMet = true;
                    break;
                case 'drawdownIsShallow':
                    if (features.drawdownIsShallow === condition.value) isMet = true;
                    break;
                case 'baselineBelowPool':
                    if (features.baselineBelowPool === condition.value) isMet = true;
                    break;
                case 'baselineAbovePool':
                    if (features.baselineAbovePool === condition.value) isMet = true;
                    break;
                case 'peakOverBaseline':
                    if (condition.operator === 'gt' && features.peakOverBaseline > (condition.value as number)) isMet = true;
                    if (condition.operator === 'lt' && features.peakOverBaseline < (condition.value as number)) isMet = true;
                    break;
                case 'baselineTrend':
                     if (features.baselineTrend === condition.value) isMet = true;
                    break;
            }

            if (isMet) {
                confidence += condition.weight;
                conditionsMet++;
            }
        });

        // Only add diagnosis if at least one condition was met
        if (conditionsMet > 0) {
            // Normalize confidence by number of conditions? Optional.
            // For now, it's an additive score. Cap at 1.
            const finalConfidence = Math.min(1, confidence);

            if (finalConfidence > 0.3) { // Threshold to be considered a potential issue
                 diagnoses.push({
                    ruleId: rule.id,
                    title: rule.issue,
                    confidence: finalConfidence,
                    investigation: rule.investigation,
                });
            }
        }
    });

    return diagnoses.sort((a, b) => b.confidence - a.confidence);
}
