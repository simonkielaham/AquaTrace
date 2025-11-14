
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
} satisfies ChartConfig;

const elevationColors = [
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function PerformanceChart({
  data,
  asset,
}: PerformanceChartProps) {
  const { permanentPoolElevation, designElevations } = asset;
  
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
              data={data}
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
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
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
              <ReferenceLine
                y={permanentPoolElevation}
                yAxisId="left"
                stroke="hsl(var(--primary))"
                strokeDasharray="3 3"
                strokeWidth={1.5}
              >
                <ReferenceLine.Label
                  value="Pool Elevation"
                  position="insideTopLeft"
                  fill="hsl(var(--primary))"
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
