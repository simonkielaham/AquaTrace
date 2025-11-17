
"use client";

import type { Asset, DataPoint } from "@/lib/placeholder-data";
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
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, ReferenceLine } from "recharts";
import { useAssets } from "@/context/asset-context";
import * as React from "react";

type PerformanceChartProps = {
  asset: Asset;
};

const chartConfig = {
  waterLevel: {
    label: "Water Elevation",
    color: "hsl(var(--chart-1))",
  },
  ppe: {
    label: "Permanent Pool",
    color: "hsl(var(--chart-2))",
  },
};

export default function PerformanceChart({
  asset,
}: PerformanceChartProps) {
  const { getProcessedData, loading: contextLoading } = useAssets();
  const [chartData, setChartData] = React.useState<DataPoint[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!asset.id) return;
      setLoading(true);
      const data = await getProcessedData(asset.id);
      if (isMounted) {
        // Convert timestamps from strings to Date objects
        const formattedData = data.map(d => ({
          ...d,
          timestamp: new Date(d.timestamp),
        }));
        setChartData(formattedData);
        setLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false };
  }, [asset.id, getProcessedData]);

  if (loading || contextLoading) {
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
                  <p className="text-xs">Upload a datafile to see performance metrics.</p>
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
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => new Date(label).toLocaleString()}
                  indicator="dot"
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
            />
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

    