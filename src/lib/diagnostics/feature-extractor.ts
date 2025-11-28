
import { AnalysisPeriod, ChartablePoint } from '../placeholder-data';

export interface HydrographFeatures {
    // Event-specific metrics
    eventId: string;
    peakWaterLevel: number | undefined;
    baselineWaterLevel: number | undefined;
    peakOverBaseline: number;
    drawdownDuration: number | undefined; // in hours
    drawdownRate: number | undefined; // m/hr
    drawdownIsSteep: boolean;
    drawdownIsShallow: boolean;
    risingLimbRate: number | undefined; // m/hr
    rainToPeakRatio: number; // m / mm
    totalRainfall: number;

    // Longer-term baseline metrics
    baselineTrend: 'rising' | 'falling' | 'stable';
    baselineBelowPool: boolean;
    baselineAbovePool: boolean;
}

// Simple linear regression to find slope
function calculateSlope(points: ChartablePoint[]): number | undefined {
    if (points.length < 2) return undefined;
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    points.forEach(p => {
        sumX += p.timestamp;
        sumY += p.waterLevel!;
        sumXY += p.timestamp * p.waterLevel!;
        sumXX += p.timestamp * p.timestamp;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope * 1000 * 60 * 60; // Convert from m/ms to m/hr
}


export function extractFeatures(
    event: AnalysisPeriod,
    allData: ChartablePoint[],
    permanentPoolElevation: number,
    designDrawdown: number
): HydrographFeatures {

    const { analysis, startDate, endDate, totalPrecipitation } = event;
    const peakTimestamp = analysis?.peakTimestamp || 0;

    // Rising Limb
    const risingLimbPoints = event.dataPoints.filter(p => p.timestamp <= peakTimestamp && p.waterLevel !== undefined);
    const risingLimbRate = calculateSlope(risingLimbPoints);

    // Drawdown Limb
    const drawdownPoints = event.dataPoints.filter(p => p.timestamp >= peakTimestamp && p.waterLevel !== undefined);
    const drawdownRate = calculateSlope(drawdownPoints);
    const drawdownDuration = analysis?.timeToBaseline ? (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60) : undefined;
    
    // Baseline Trend (simplified)
    const preEventPoints = allData.filter(p => p.timestamp < startDate && p.waterLevel !== undefined).slice(-10);
    const postEventPoints = allData.filter(p => p.timestamp > endDate && p.waterLevel !== undefined).slice(0, 10);
    const preEventAvg = preEventPoints.reduce((sum, p) => sum + p.waterLevel!, 0) / preEventPoints.length;
    const postEventAvg = postEventPoints.reduce((sum, p) => sum + p.waterLevel!, 0) / postEventPoints.length;
    let baselineTrend: 'rising' | 'falling' | 'stable' = 'stable';
    if(preEventPoints.length > 2 && postEventPoints.length > 2) {
        if(postEventAvg > preEventAvg + 0.05) baselineTrend = 'rising';
        if(postEventAvg < preEventAvg - 0.05) baselineTrend = 'falling';
    }
    
    return {
        eventId: event.id,
        peakWaterLevel: analysis?.peakElevation,
        baselineWaterLevel: analysis?.baselineElevation,
        peakOverBaseline: (analysis?.peakElevation || 0) - (analysis?.baselineElevation || 0),
        drawdownDuration: drawdownDuration,
        drawdownRate: drawdownRate,
        drawdownIsSteep: drawdownRate !== undefined && drawdownDuration !== undefined && drawdownDuration < (designDrawdown * 0.75),
        drawdownIsShallow: drawdownRate !== undefined && drawdownDuration !== undefined && drawdownDuration > (designDrawdown * 1.25),
        risingLimbRate: risingLimbRate,
        rainToPeakRatio: totalPrecipitation > 0 ? ((analysis?.peakElevation || 0) - (analysis?.baselineElevation || 0)) / totalPrecipitation : 0,
        totalRainfall: totalPrecipitation,

        baselineTrend: baselineTrend,
        baselineBelowPool: (analysis?.baselineElevation || permanentPoolElevation) < permanentPoolElevation - 0.05,
        baselineAbovePool: (analysis?.baselineElevation || permanentPoolElevation) > permanentPoolElevation + 0.05,
    };
}
