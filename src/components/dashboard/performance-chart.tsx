
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, ReferenceLine, Scatter } from "recharts";
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

export default function PerformanceChart({
  asset,
  dataVersion,
}: PerformanceChartProps) {
  const [chartData, setChartData] = React.useState<DataPoint[]>([]);
  const [surveyPoints, setSurveyPoints] = React.useState<SurveyPoint[]>([]);
  const [loading, setLoading] = React.useState(true);

  const yAxisDomain = React.useMemo(() => {
    const allElevations = [
        ...chartData.map(d => d.waterLevel),
        ...surveyPoints.map(p => p.elevation)
    ];

    if (allElevations.length === 0) {
      return [
        asset.permanentPoolElevation - 2,
        asset.permanentPoolElevation + 2,
      ];
    }
    
    const min = Math.min(...allElevations);
    const max = Math.max(...allElevations);
    
    const range = max - min;

    if (range === 0) {
        return [min - 1, max + 1];
    }
    
    const buffer = range * 0.1; // 10% buffer
    
    return [min - buffer, max + buffer];
  }, [chartData, surveyPoints, asset.permanentPoolElevation]);


  React.useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!asset.id) return;
      setLoading(true);
      const [data, points] = await Promise.all([
        getProcessedDataAction(asset.id),
        getSurveyPointsAction(asset.id)
      ]);
      
      if (isMounted) {
        setChartData(data);
        setSurveyPoints(points);
        setLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false };
  }, [asset.id, dataVersion]);

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

  if (chartData.length === 0 && surveyPoints.length === 0) {
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
              domain={yAxisDomain}
              allowDataOverflow={true}
              type="number"
              dataKey="waterLevel"
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
                      const diff = (value - asset.permanentPoolElevation) * 100; // difference in cm
                      const isPositive = diff >= 0;
                      const direction = isPositive ? 'above' : 'below';
                      const diffText = `${Math.abs(diff).toFixed(1)}cm ${direction} permanent pool`;

                      return (
                        <div className="flex items-center gap-2">
                           <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: 'var(--color-waterLevel)'}}/>
                            <div className="flex flex-col items-start">
                                <span className="font-bold">WATER ELEVATION: {`${value.toFixed(2)}m`}</span>
                                <span className={cn(
                                  "text-xs",
                                  isPositive ? "text-green-600" : "text-destructive"
                                )}>
                                  ({diffText})
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
            />
             <Scatter data={surveyPoints} fill="var(--color-surveyPoints)" name="Survey Points" dataKey="elevation" />
            <ReferenceLine
              y={asset.permanentPoolElevation}
              label={{ value: "PPE", position: "right", fill: "hsl(var(--muted-foreground))" }}
              stroke="var(--color-ppe)"
              strokeWidth={2}
            />
             {asset.designElevations.map(de => (
               <ReferenceLine
                key={de.year}
                y={de.elevation}
                label={{ value: `${de.year}-Year`, position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: '10px' }}
                stroke="hsl(var(--destructive))"
                strokeDasharray="3 3"
              />
             ))}

            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
