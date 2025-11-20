
"use client";

import type { Asset, ChartablePoint } from "@/lib/placeholder-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { BarChart, AreaChart as AreaChartIcon, Save, TableIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { AreaChart, Area, Bar, CartesianGrid, XAxis, YAxis, ReferenceLine, Brush, Legend, Scatter } from "recharts";
import * as React from "react";
import { cn } from "@/lib/utils";

type PerformanceChartProps = {
  asset: Asset;
  chartData: ChartablePoint[];
  loading: boolean;
};

const chartConfig = {
  waterLevel: {
    label: "Water Elevation",
    color: "hsl(var(--chart-1))",
  },
  precipitation: {
    label: "Precipitation",
    color: "hsl(var(--chart-2))",
  },
  elevation: {
    label: "Survey Points",
    color: "hsl(var(--accent))",
  },
  ppe: {
    label: "Permanent Pool",
    color: "hsl(var(--chart-2))",
  },
};

const AnalysisDialog = ({ 
    asset,
    data, 
    range,
    isOpen,
    onOpenChange
}: { 
    asset: Asset,
    data: ChartablePoint[], 
    range: { startIndex: number, endIndex: number },
    isOpen: boolean,
    onOpenChange: (open: boolean) => void,
}) => {
    
    const analysisData = data.slice(range.startIndex, range.endIndex + 1);
    const startDate = new Date(data[range.startIndex]?.timestamp);
    const endDate = new Date(data[range.endIndex]?.timestamp);
    
    // Placeholder for analysis logic
    const analysisResult = React.useMemo(() => {
        // This is where future logic for slope change will go.
        return "Analysis has not been run yet."
    }, [analysisData]);
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[825px]">
                 <DialogHeader>
                    <DialogTitle>Drawdown Analysis for {asset.name}</DialogTitle>
                    <DialogDescription>
                        Analyzing data from {startDate.toLocaleString()} to {endDate.toLocaleString()}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-4">
                    <div className="space-y-4">
                        <h4 className="font-semibold">Analysis Results</h4>
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-sm text-muted-foreground">{analysisResult}</p>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-semibold">Data Points in Range ({analysisData.length})</h4>
                        <ScrollArea className="h-[400px] border rounded-md">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>Water Level</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {analysisData.map((d, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{new Date(d.timestamp).toLocaleString()}</TableCell>
                                            <TableCell>{d.waterLevel ? d.waterLevel.toFixed(4) + 'm' : 'N/A'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button><Save className="mr-2 h-4 w-4"/> Save Analysis</Button>
                 </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function PerformanceChart({
  asset,
  chartData,
  loading,
}: PerformanceChartProps) {
  const [selectedRange, setSelectedRange] = React.useState<{ startIndex: number; endIndex: number } | null>(null);
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = React.useState(false);
  const [isDataTableOpen, setIsDataTableOpen] = React.useState(false);
  const [yZoomRange, setYZoomRange] = React.useState<[number, number] | null>(null);

  const yAxisBounds = React.useMemo(() => {
    if (loading) {
      return ['auto', 'auto'];
    }

    const dataToConsider = selectedRange
      ? chartData.slice(selectedRange.startIndex, selectedRange.endIndex + 1)
      : chartData;

    if (dataToConsider.length === 0) {
      // If there's no data in the selected range, fall back to asset elevations
       const assetElevations = [
        asset.permanentPoolElevation,
        ...asset.designElevations.filter(de => de.elevation > 0).map(de => de.elevation)
      ].filter(e => typeof e === 'number' && isFinite(e));
      
      if (assetElevations.length === 0) return [0, 1]; // Absolute fallback

      const min = Math.min(...assetElevations);
      const max = Math.max(...assetElevations);
      const padding = (max - min) * 0.2 || 1;
      return [min - padding, max + padding];
    }
      
    const allElevations: number[] = dataToConsider.flatMap(d => {
        const points = [];
        if (d.waterLevel !== undefined) points.push(d.waterLevel);
        if (d.elevation !== undefined) points.push(d.elevation);
        return points;
    });

    allElevations.push(asset.permanentPoolElevation);
    asset.designElevations.filter(de => de.elevation > 0).forEach(de => {
        allElevations.push(de.elevation);
    });
    
    const validElevations = allElevations.filter(e => typeof e === 'number' && isFinite(e));
    if (validElevations.length === 0) {
        return [0, 1]; // Fallback
    }

    const dataMin = Math.min(...validElevations);
    const dataMax = Math.max(...validElevations);
    
    const padding = (dataMax - dataMin) * 0.1 || 1;

    return [dataMin - padding, dataMax + padding];
  }, [chartData, asset, loading, selectedRange]);


  React.useEffect(() => {
    // When the primary data range changes, reset the zoom slider
    // to match the new overall boundaries.
    if (!loading) {
      setYZoomRange(yAxisBounds as [number, number]);
    }
  }, [yAxisBounds, loading]);

  React.useEffect(() => {
    // Reset selection when chart data changes
    setSelectedRange(null);
  }, [chartData]);


  if (loading) {
    return (
       <Card className="col-span-1 lg:col-span-4 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline">Performance Overview</CardTitle>
          <CardDescription>
            Water elevation and precipitation over time against design elevations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
            <p>Loading chart data for {asset.name}...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return (
      <Card className="col-span-1 lg:col-span-4 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline">Performance Overview</CardTitle>
          <CardDescription>
            Water elevation and precipitation over time against design elevations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
              <div className="text-center">
                  <BarChart className="mx-auto h-8 w-8 mb-2" />
                  <p>No performance data available.</p>
                  <p className="text-xs">Upload a datafile or add a survey point to see performance metrics.</p>
              </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 lg:col-span-4 shadow-sm">
      <CardHeader>
        <CardTitle className="font-headline">Performance Overview</CardTitle>
        <CardDescription>
          Water elevation and precipitation over time against design elevations.
        </CardDescription>
      </CardHeader>
      <CardContent>
       <div className="w-full flex gap-4">
        <ChartContainer config={chartConfig} className="h-[400px] w-full flex-1">
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 30, bottom: 50 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              type="number"
              domain={['dataMin', 'dataMax']}
            />
            <YAxis
              yAxisId="left"
              unit="m"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              type="number"
              domain={yZoomRange || yAxisBounds}
              tickFormatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
              allowDataOverflow={true}
              label={{ value: 'Water Elevation (m)', angle: -90, position: 'insideLeft', offset: -20 }}
            />
             <YAxis
              yAxisId="right"
              orientation="right"
              unit="mm"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              type="number"
              domain={[0, 'dataMax']}
              label={{ value: 'Precipitation (mm)', angle: -90, position: 'insideRight', offset: 10 }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => {
                    if (typeof label === 'number') {
                      return new Date(label).toLocaleString();
                    }
                    return 'Invalid Date';
                  }}
                  indicator="dot"
                  formatter={(value, name, item) => {
                    const payload = item.payload as ChartablePoint;
                    const waterLevelItem = payload.waterLevel !== undefined ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: 'var(--color-waterLevel)'}}/>
                            <div className="flex flex-col items-start gap-1">
                                <span className="font-bold">WATER ELEVATION: {`${payload.waterLevel.toFixed(3)}m`}</span>
                                <span className={cn(
                                  "text-xs",
                                  payload.waterLevel >= asset.permanentPoolElevation ? "text-green-600 dark:text-green-500" : "text-destructive"
                                )}>
                                   ({(Math.abs(payload.waterLevel - asset.permanentPoolElevation) * 100).toFixed(1)}cm {payload.waterLevel >= asset.permanentPoolElevation ? 'above' : 'below'} PPE)
                                </span>
                            </div>
                        </div>
                      ) : null;
                    
                    const surveyPointItem = payload.elevation !== undefined ? (
                         <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: 'var(--color-elevation)'}}/>
                          <span>Manual Survey: {`${payload.elevation.toFixed(3)}m`}</span>
                        </div>
                    ) : null;

                     const precipitationItem = (payload.precipitation ?? 0) > 0 ? (
                        <div className="flex items-center gap-2">
                           <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: 'var(--color-precipitation)'}}/>
                           <span>Precipitation: {`${(payload.precipitation ?? 0).toFixed(2)}mm`}</span>
                        </div>
                      ) : null;

                    return (
                      <>
                        {waterLevelItem}
                        {surveyPointItem}
                        {precipitationItem}
                      </>
                    )
                  }}
                />
              }
            />
            <Area
              yAxisId="left"
              dataKey="waterLevel"
              type="monotone"
              fill="var(--color-waterLevel)"
              fillOpacity={0.4}
              stroke="var(--color-waterLevel)"
              stackId="a"
              name="Water Elevation"
              connectNulls
              dot={false}
            />
             <Bar
              yAxisId="right"
              dataKey="precipitation"
              fill="var(--color-precipitation)"
              name="Precipitation"
              radius={[4, 4, 0, 0]}
            />
            <ReferenceLine
              yAxisId="left"
              y={asset.permanentPoolElevation}
              label={{ value: "PPE", position: "right", fill: "hsl(var(--muted-foreground))" }}
              stroke="var(--color-ppe)"
              strokeWidth={2}
              isFront
            />
            {asset.designElevations.filter(de => de.elevation > 0).map(de => (
              <ReferenceLine
                yAxisId="left"
                key={de.name}
                y={de.elevation}
                label={{ value: de.name, position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: '10px' }}
                stroke="hsl(var(--destructive))"
                strokeDasharray="3 3"
                isFront
              />
            ))}
            <Scatter 
              yAxisId="left" 
              dataKey="elevation" 
              fill="var(--color-elevation)"
              shape="diamond"
              name="Survey Points"
            />
            <Brush 
                dataKey="timestamp" 
                height={30} 
                stroke="hsl(var(--chart-1))"
                tickFormatter={(value) => new Date(value as number).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                y={350}
                onChange={(range) => setSelectedRange(range as { startIndex: number; endIndex: number; })}
            />
            <Legend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
        {yZoomRange && Array.isArray(yAxisBounds) && typeof yAxisBounds[0] === 'number' && typeof yAxisBounds[1] === 'number' && (
          <div className="w-10 flex flex-col items-center">
             <Slider
              orientation="vertical"
              min={yAxisBounds[0]}
              max={yAxisBounds[1]}
              step={(yAxisBounds[1] - yAxisBounds[0]) / 100}
              value={[yZoomRange[0], yZoomRange[1]]}
              onValueChange={(value) => setYZoomRange(value as [number, number])}
              className="h-full"
              minStepsBetweenThumbs={1}
            />
          </div>
        )}
        </div>
        
        <div className="mt-8 flex items-center justify-end gap-2">
             <Button 
                variant="outline"
                onClick={() => setIsDataTableOpen(true)}
             >
                <TableIcon className="mr-2 h-4 w-4" />
                View Data
            </Button>
             <Button 
                onClick={() => setIsAnalysisDialogOpen(true)}
                disabled={!selectedRange || selectedRange.startIndex === undefined || selectedRange.endIndex === undefined}
             >
                <AreaChartIcon className="mr-2 h-4 w-4" />
                Analyze Selected Range
            </Button>
        </div>
        
        {selectedRange && <AnalysisDialog 
            asset={asset}
            isOpen={isAnalysisDialogOpen}
            onOpenChange={setIsAnalysisDialogOpen}
            data={chartData}
            range={selectedRange}
        />}

        <Dialog open={isDataTableOpen} onOpenChange={setIsDataTableOpen}>
            <DialogContent className="sm:max-w-[725px]">
                <DialogHeader>
                    <DialogTitle>Chart Data for {asset.name}</DialogTitle>
                    <DialogDescription>
                        Raw data points used to generate the performance chart.
                    </DialogDescription>
                </DialogHeader>
                 <ScrollArea className="h-[60vh] border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Water Elevation</TableHead>
                                <TableHead>Precipitation</TableHead>
                                <TableHead>Survey Elevation</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {chartData.map((d, i) => (
                                <TableRow key={i}>
                                    <TableCell>{new Date(d.timestamp).toLocaleString()}</TableCell>
                                    <TableCell>{d.waterLevel !== undefined ? d.waterLevel.toFixed(4) : 'N/A'}</TableCell>
                                    <TableCell>{d.precipitation !== undefined && d.precipitation > 0 ? d.precipitation.toFixed(2) : 'N/A'}</TableCell>
                                    <TableCell>{d.elevation !== undefined ? d.elevation.toFixed(4) : 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
}
