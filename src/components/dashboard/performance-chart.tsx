
"use client";

import type { DataPoint, Asset } from "@/lib/placeholder-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

type PerformanceChartProps = {
  data: DataPoint[];
  asset: Asset;
};

const chartConfig = {
  waterElevation: {
    label: "Water Elevation (m)",
    color: "hsl(var(--chart-1))",
  },
  precipitation: {
    label: "Precipitation (mm)",
    color: "hsl(var(--chart-2))",
  },
  permanentPoolElevation: {
    label: "Permanent Pool",
    color: "hsl(210 40% 56%)",
  },
} satisfies ChartConfig;

const elevationColors = [
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const CustomTooltipContent = (props: any) => {
  const { active, payload, label, asset } = props;

  if (active && payload && payload.length) {
    // Exclude the permanent pool from the main list
    const filteredPayload = payload.filter(
      (p: any) => p.dataKey !== "permanentPoolElevation"
    );

    // Find the water elevation data point
    const waterElevationPoint = payload.find(
      (p: any) => p.dataKey === "waterElevation"
    );
    const currentWaterElevation = waterElevationPoint?.value;

    let depthAbovePoolMm: number | null = null;
    if (currentWaterElevation !== undefined && asset?.permanentPoolElevation !== undefined) {
      depthAbovePoolMm = (currentWaterElevation - asset.permanentPoolElevation) * 1000;
    }
    
    return (
       <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <div className="font-medium">
          {new Date(label).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
        <div className="grid gap-1.5">
          {filteredPayload.map((item: any, index: number) => (
             <div
                key={index}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground"
                )}
              >
                <div
                  className="shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg] w-1"
                  style={{
                      "--color-bg": item.color,
                      "--color-border": item.color,
                    } as React.CSSProperties
                  }
                />
                <div
                  className="flex flex-1 justify-between leading-none"
                >
                  <span className="text-muted-foreground">
                    {chartConfig[item.dataKey as keyof typeof chartConfig]?.label || item.name}
                  </span>
                  {item.value && (
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
          ))}
          {depthAbovePoolMm !== null && (
            <div
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground"
                )}
              >
                <div
                  className="shrink-0 rounded-[2px] border-transparent bg-transparent w-1"
                />
                <div
                  className="flex flex-1 justify-between leading-none"
                >
                  <span className="text-muted-foreground">
                    Depth Above Pool (mm)
                  </span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {depthAbovePoolMm.toFixed(0)}
                  </span>
                </div>
              </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};


export default function PerformanceChart({
  data,
  asset,
}: PerformanceChartProps) {
  const { permanentPoolElevation, designElevations } = asset;
  
  const chartData = data.map(item => ({
    ...item,
    permanentPoolElevation,
  }));

  return (
    <Card className="col-span-1 lg:col-span-4 shadow-sm">
      <CardHeader>
        <CardTitle className="font-headline">Performance Overview</CardTitle>
        <CardDescription>
          Water elevation and precipitation over time against design elevations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer>
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
                tickLine={false}
                axisLine={false}
                padding={{ left: 20, right: 20 }}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                label={{
                  value: "Water Elevation (m)",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: 'middle', fill: 'hsl(var(--foreground))' },
                  dy: 40
                }}
                stroke="hsl(var(--chart-1))"
                domain={['auto', 'auto']}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{
                  value: "Precipitation (mm)",
                  angle: 90,
                  position: "insideRight",
                  style: { textAnchor: 'middle', fill: 'hsl(var(--foreground))' },
                  dy: -50
                }}
                stroke="hsl(var(--chart-2))"
              />
              <Tooltip
                cursor={false}
                content={<CustomTooltipContent asset={asset} />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="precipitation"
                yAxisId="right"
                fill="hsl(var(--chart-2))"
                radius={4}
                barSize={10}
              />
              <Line
                type="monotone"
                dataKey="waterElevation"
                yAxisId="left"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={false}
              />
               <Line
                yAxisId="left"
                dataKey="permanentPoolElevation"
                stroke={chartConfig.permanentPoolElevation.color}
                strokeWidth={0}
                dot={false}
                activeDot={false}
              />
              <ReferenceLine
                y={permanentPoolElevation}
                yAxisId="left"
                stroke={chartConfig.permanentPoolElevation.color}
                strokeDasharray="3 3"
                strokeWidth={1.5}
              >
                <ReferenceLine.Label
                  value="Perm. Pool"
                  position="insideTopLeft"
                  fill={chartConfig.permanentPoolElevation.color}
                  fontSize={10}
                />
              </ReferenceLine>
              {designElevations.map((de, index) => (
                 <ReferenceLine
                    key={`de-${de.year}`}
                    y={de.elevation}
                    yAxisId="left"
                    stroke={elevationColors[index % elevationColors.length]}
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                  >
                    <ReferenceLine.Label
                      value={`${de.year}-Year Storm`}
                      position="insideTopLeft"
                      fill={elevationColors[index % elevationColors.length]}
                      fontSize={10}
                    />
                  </ReferenceLine>
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
