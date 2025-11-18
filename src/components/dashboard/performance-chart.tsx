
"use client";

import type { Asset, ChartablePoint } from "@/lib/placeholder-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Info, BarChart, AreaChart as AreaChartIcon, Save } from "lucide-react";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, ReferenceLine, Scatter, Dot, Brush } from "recharts";
import { getProcessedData as getProcessedDataAction, getSurveyPoints as getSurveyPointsAction } from "@/app/actions";
import * as React from "react";
import { cn } from "@/lib/utils";

type PerformanceChartProps = {
  asset: Asset;
  dataVersion?: number;
};

const chartConfig = {
  waterLevel: {
    label: "Water Elevation",
    color: "hsl(var(--chart-1))",
  },
  surveyPoints: {
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
  dataVersion,
}: PerformanceChartProps) {
  const [chartData, setChartData] = React.useState<ChartablePoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedRange, setSelectedRange] = React.useState<{ startIndex: number; endIndex: number } | null>(null);
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = React.useState(false);

  const yAxisDomain = React.useMemo(() => {
    if (loading || chartData.length === 0) {
      return ['auto', 'auto'];
    }
      
    const allElevations: number[] = chartData.flatMap(d => {
        const points = [];
        if (d.waterLevel !== undefined) points.push(d.waterLevel);
        if (d.elevation !== undefined) points.push(d.elevation);
        return points;
    });

    allElevations.push(asset.permanentPoolElevation);
    asset.designElevations.forEach(de => {
        if (de.elevation > 0) allElevations.push(de.elevation);
    });
    
    if (allElevations.length === 0) {
        return ['auto', 'auto'];
    }

    const dataMin = Math.min(...allElevations);
    const dataMax = Math.max(...allElevations);
    
    const padding = (dataMax - dataMin) * 0.1 || 1;

    return [dataMin - padding, dataMax + padding];
  }, [chartData, asset, loading]);


  React.useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!asset.id) return;
      setLoading(true);
      setChartData([]); // Reset data on asset change
      
      const [processedData, surveyPoints] = await Promise.all([
        getProcessedDataAction(asset.id),
        getSurveyPointsAction(asset.id)
      ]);
      
      if (isMounted) {
        const dataMap = new Map<number, ChartablePoint>();

        processedData.forEach(p => {
          const timestamp = new Date(p.timestamp).getTime();
          if (!dataMap.has(timestamp)) {
            dataMap.set(timestamp, { timestamp });
          }
          dataMap.get(timestamp)!.waterLevel = p.waterLevel;
        });

        surveyPoints.forEach(p => {
          const timestamp = new Date(p.timestamp).getTime();
          if (!dataMap.has(timestamp)) {
            dataMap.set(timestamp, { timestamp });
          }
          dataMap.get(timestamp)!.elevation = p.elevation;
        });
        
        const mergedData = Array.from(dataMap.values()).sort((a,b) => a.timestamp - b.timestamp);
        
        setChartData(mergedData);
        setLoading(false);
        setSelectedRange(null); // Reset selection on data change
      }
    };
    fetchData();
    return () => { isMounted = false };
  }, [asset, dataVersion]);


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
          Water elevation over time against design elevations.
        </CardDescription>
      </CardHeader>
      <CardContent>
       <div className="w-full">
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
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
              unit="m"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              type="number"
              domain={yAxisDomain}
              tickFormatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
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
                    if (item.dataKey === 'waterLevel' && typeof value === 'number') {
                      const diff = (value - asset.permanentPoolElevation);
                      const isPositive = diff >= 0;
                      const direction = isPositive ? 'above' : 'below';
                      const diffText = `(${Math.abs(diff * 100).toFixed(1)}cm ${direction} permanent pool)`;

                      return (
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: 'var(--color-waterLevel)'}}/>
                            <div className="flex flex-col items-start">
                                <span className="font-bold">WATER ELEVATION: {`${value.toFixed(2)}m`}</span>
                                <span className={cn(
                                  "text-xs",
                                  isPositive ? "text-green-600 dark:text-green-500" : "text-destructive"
                                )}>
                                  {diffText}
                                </span>
                            </div>
                        </div>
                      )
                    }
                    if (item.dataKey === 'elevation' && typeof value === 'number') {
                      return (
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: 'var(--color-surveyPoints)'}}/>
                            <div className="flex flex-col items-start">
                                <span className="font-bold">SURVEY POINT: {`${value.toFixed(2)}m`}</span>
                            </div>
                        </div>
                      )
                    }
                    return null;
                  }}
                />
              }
            />
            <Area
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
            <Scatter 
                dataKey="elevation" 
                fill="var(--color-surveyPoints)" 
                name="Survey Points" 
                shape={<Dot r={4} strokeWidth={2} stroke="var(--background)" />}
            />
            <ReferenceLine
              y={asset.permanentPoolElevation}
              label={{ value: "PPE", position: "right", fill: "hsl(var(--muted-foreground))" }}
              stroke="var(--color-ppe)"
              strokeWidth={2}
              isFront
            />
            {asset.designElevations.filter(de => de.elevation > 0).map(de => (
              <ReferenceLine
                key={de.name}
                y={de.elevation}
                label={{ value: de.name, position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: '10px' }}
                stroke="hsl(var(--destructive))"
                strokeDasharray="3 3"
                isFront
              />
            ))}
            {chartData.filter(d => d.elevation !== undefined).map(d => (
                <ReferenceLine 
                    key={`dropline-${d.timestamp}`}
                    x={d.timestamp}
                    stroke="hsl(var(--accent))"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                />
            ))}
            <Brush 
                dataKey="timestamp" 
                height={30} 
                stroke="hsl(var(--chart-1))"
                tickFormatter={(value) => new Date(value as number).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                y={350}
                onChange={(range) => setSelectedRange(range)}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
        </div>
        
        <div className="mt-8 flex flex-col items-end gap-4">
             <Button 
                onClick={() => setIsAnalysisDialogOpen(true)}
                disabled={!selectedRange || selectedRange.startIndex === undefined || selectedRange.endIndex === undefined}
             >
                <AreaChartIcon className="mr-2 h-4 w-4" />
                Analyze Selected Range
            </Button>

            <h4 className="font-medium mb-2 self-start">Chart Data</h4>
            <ScrollArea className="h-[200px] border rounded-md w-full">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Calculated Water Elevation</TableHead>
                            <TableHead>Survey Point Elevation</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {chartData.map((d, i) => (
                            <TableRow key={i}>
                                <TableCell>{new Date(d.timestamp).toLocaleString()}</TableCell>
                                <TableCell>{d.waterLevel !== undefined ? d.waterLevel.toFixed(4) : 'N/A'}</TableCell>
                                <TableCell>{d.elevation !== undefined ? d.elevation.toFixed(4) : 'N/A'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
        
        {selectedRange && <AnalysisDialog 
            asset={asset}
            isOpen={isAnalysisDialogOpen}
            onOpenChange={setIsAnalysisDialogOpen}
            data={chartData}
            range={selectedRange}
        />}

      </CardContent>
    </Card>
  );
}
