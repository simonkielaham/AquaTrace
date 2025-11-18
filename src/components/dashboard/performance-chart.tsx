
"use client";

import type { Asset, DataPoint, SurveyPoint } from "@/lib/placeholder-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Info, BarChart } from "lucide-react";
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
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, ReferenceLine, Scatter, Dot } from "recharts";
import { getProcessedData as getProcessedDataAction, getSurveyPoints as getSurveyPointsAction } from "@/app/actions";
import * as React from "react";
import { cn } from "@/lib/utils";

type ChartablePoint = {
    timestamp: number;
    waterLevel?: number;
    elevation?: number;
}

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

export default function PerformanceChart({
  asset,
  dataVersion,
}: PerformanceChartProps) {
  const [chartData, setChartData] = React.useState<ChartablePoint[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!asset.id) return;
      setLoading(true);
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
      }
    };
    fetchData();
    return () => { isMounted = false };
  }, [asset.id, dataVersion]);
  
  const yAxisDomain = React.useMemo(() => {
    if (chartData.length === 0) {
      return [asset.permanentPoolElevation - 1, asset.permanentPoolElevation + 1];
    }
    const allElevations = chartData.flatMap(d => [d.waterLevel, d.elevation]).filter(v => typeof v === 'number') as number[];
    allElevations.push(asset.permanentPoolElevation);
    asset.designElevations.forEach(de => allElevations.push(de.elevation));

    if (allElevations.length === 0) {
       return [asset.permanentPoolElevation - 1, asset.permanentPoolElevation + 1];
    }

    const minVal = Math.min(...allElevations);
    const maxVal = Math.max(...allElevations);

    const padding = (maxVal - minVal) * 0.1 || 1; // Add padding, default to 1m if no range

    return [Math.floor((minVal - padding) * 10) / 10, Math.ceil((maxVal + padding) * 10) / 10];
  }, [chartData, asset]);


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
          <div className="h-[300px] flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
            <p>Loading chart data...</p>
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
          <div className="h-[300px] flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
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
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
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
             {asset.designElevations.map(de => (
               <ReferenceLine
                key={de.year}
                y={de.elevation}
                label={{ value: `${de.year}-Year`, position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: '10px' }}
                stroke="hsl(var(--destructive))"
                strokeDasharray="3 3"
                isFront
              />
             ))}
             {/* Add droplines for each survey point */}
             {chartData.filter(d => d.elevation !== undefined).map(d => (
                <ReferenceLine 
                    key={`dropline-${d.timestamp}`}
                    x={d.timestamp}
                    stroke="hsl(var(--accent))"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                />
             ))}

            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>

        <div className="mt-6">
            <h4 className="font-medium mb-2">Chart Data</h4>
            <ScrollArea className="h-[200px] border rounded-md">
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

      </CardContent>
    </Card>
  );
}
