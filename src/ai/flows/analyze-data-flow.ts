'use server';
/**
 * @fileOverview An AI flow for analyzing stormwater management data.
 *
 * - analyzeData - A function that handles the data analysis process.
 * - AnalyzeDataInput - The input type for the analyzeData function.
 * - AnalyzeDataOutput - The return type for the analyzeData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalysisResultSchema = z.object({
    type: z.enum(["Blocked Outlet", "Potential Leak", "Normal Drainage", "High Inflow"]),
    severity: z.enum(["high", "medium", "low", "info"]),
    description: z.string().describe("A concise explanation of the finding."),
    timestamp: z.string().describe("The ISO 8601 timestamp of when the event occurred."),
});

const AnalyzeDataInputSchema = z.object({
  csvData: z.string().describe("The CSV content of the water level and precipitation data."),
  assetName: z.string().describe("The name of the asset being analyzed."),
  permanentPoolElevation: z.number().describe("The permanent pool elevation of the asset in meters."),
});
export type AnalyzeDataInput = z.infer<typeof AnalyzeDataInputSchema>;

const AnalyzeDataOutputSchema = z.object({
    results: z.array(AnalysisResultSchema).describe("A list of analysis results found in the data."),
});
export type AnalyzeDataOutput = z.infer<typeof AnalyzeDataOutputSchema>;


export async function analyzeData(input: AnalyzeDataInput): Promise<AnalyzeDataOutput> {
  return analyzeDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeDataPrompt',
  input: {schema: AnalyzeDataInputSchema},
  output: {schema: AnalyzeDataOutputSchema},
  prompt: `You are a stormwater management expert. Your task is to analyze time-series data for a stormwater asset and identify key events or anomalies.

The asset is named '{{assetName}}' and its permanent pool elevation is {{permanentPoolElevation}} meters.

Analyze the following CSV data, which contains columns for 'time', 'waterLevel' (in meters), and 'precipitation' (in mm).

- **Blocked Outlet (medium/high severity):** Look for periods where the water level rises after a precipitation event but fails to return to near the permanent pool elevation within a reasonable time (e.g., 24-48 hours).
- **Potential Leak (high severity):** Identify if the water level consistently drops significantly below the permanent pool elevation during dry periods.
- **High Inflow (low severity):** Note any unusually rapid increases in water level that might not correspond directly to a recorded precipitation event, suggesting other inflow sources.
- **Normal Drainage (info severity):** If the water level responds as expected to precipitation and returns to the baseline, note it as normal.

For each significant event you identify, provide a result with the type, severity, a concise description, and the timestamp where the event was most prominent.

CSV Data:
\`\`\`csv
{{{csvData}}}
\`\`\`
`,
});

const analyzeDataFlow = ai.defineFlow(
  {
    name: 'analyzeDataFlow',
    inputSchema: AnalyzeDataInputSchema,
    outputSchema: AnalyzeDataOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        return { results: [] };
    }
    return output;
  }
);
