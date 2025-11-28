

"use client";

import type { Asset, ChartablePoint } from "@/lib/placeholder-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { BarChart, AreaChart as AreaChartIcon, RefreshCw, TableIcon, TrendingDown, TrendingUp, LineChart, Thermometer, Wind, Gauge, Settings } from "lucide-react";
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
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { ComposedChart, Area, CartesianGrid, XAxis, YAxis, ReferenceLine, Brush, Legend, Scatter, Bar, Line } from "recharts";
import * as React from "react";
import { cn } from "@/lib/utils";

type PerformanceChartProps = {
  asset: Asset;
  chartData: ChartablePoint[];
  loading: boolean;
  brushRange?: { startIndex?: number; endIndex?: number };
  onBrushChange: (range: { startIndex?: number; endIndex?: number }) => void;
  visibleElevations: Record<string, boolean>;
  visibleSensorData: Record<string, boolean>;
};


const CustomLegend = ({ payload, chartConfig }: { payload?: any[], chartConfig: any }) => {
  if (!payload) return null;

  const mainPayload = payload.filter(p => ["Water Elevation", "Precipitation", "Survey Points", "Daily Precipitation", "Operational Action"].includes(p.value));
  const sensorPayload = payload.filter(p => ["Temperature", "Sensor Pressure", "Barometer"].includes(p.value));
  const designPayload = payload.filter(p => !mainPayload.map(i=>i.value).includes(p.value) && !sensorPayload.map(i=>i.value).includes(p.value) );
  
  const renderLegendItems = (items: any[]) => (
    items.map((entry, index) => {
      const config = chartConfig[entry.dataKey] || {};
      const color = config.color || entry.color;
      return (
        <div key={`item-${index}`} className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span>{entry.value}</span>
        </div>
      );
    })
  );

  return (
    <div className="flex flex-col items-center justify-center gap-2 pt-4">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {renderLegendItems(mainPayload)}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {renderLegendItems(sensorPayload)}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {renderLegendItems(designPayload)}
        </div>
    </div>
  );
};

const CustomTooltipContent = ({ active, payload, label, asset, config }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartablePoint;
    const poolElevation = asset.permanentPoolElevation;
    const offset = data.waterLevel !== undefined ? data.waterLevel - poolElevation : undefined;

    const items = [
      { key: "waterLevel", label: "Water Elevation", value: data.waterLevel, unit: "m" },
      { key: "offset", label: "Offset from Pool", value: offset, unit: "m", showSign: true },
      { key: "rawWaterLevel", label: "Raw Water Level", value: data.rawWaterLevel, unit: "m" },
      { key: "precipitation", label: "Precipitation", value: data.precipitation, unit: "mm" },
      { key: "elevation", label: "Survey Elevation", value: data.elevation, unit: "m" },
      { key: "operationalAction", label: "Action", value: data.operationalAction, unit: "" },
      { key: "temperature", label: "Temperature", value: data.temperature, unit: "°C" },
      { key: "sensorPressure", label: "Sensor Pressure", value: data.sensorPressure, unit: "kPa" },
      { key: "barometer", label: "Barometer", value: data.barometer, unit: "kPa" },
    ];
    
    return (
      <div className="grid min-w-[12rem] gap-1.5 rounded-lg border bg-background/95 p-3 text-sm shadow-xl backdrop-blur-sm">
        <div className="mb-2 font-medium">{new Date(label).toLocaleString()}</div>
        <div className="grid gap-1.5">
          {items.map((item) => {
            if (item.value !== undefined && item.value !== null) {
              const itemConfig = config[item.key] || {};
              const color = item.key === 'offset' ? (item.value > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--chart-1))') : (itemConfig.color || 'hsl(var(--foreground))');
              
              return (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
                    <span className="text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {item.showSign && typeof item.value === 'number' && item.value > 0 ? '+' : ''}
                    {typeof item.value === 'number' ? item.value.toFixed(2) : item.value}{item.unit}
                  </span>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  return null;
};


export default function PerformanceChart({
  asset,
  chartData,
  loading,
  brushRange,
  onBrushChange,
  visibleElevations,
  visibleSensorData,
}: PerformanceChartProps) {
  const [isDataTableOpen, setIsDataTableOpen] = React.useState(false);
  const [yZoomRange, setYZoomRange] = React.useState<[number, number] | null>(null);

  const chartConfig = React.useMemo(() => {
    const config: any = {
      waterLevel: {
        label: "Water Elevation",
        color: "hsl(var(--chart-1))",
        icon: LineChart
      },
      rawWaterLevel: {
        label: "Raw Water Level",
        color: "hsl(var(--chart-4))",
      },
      precipitation: {
        label: "Precipitation",
        color: "hsl(var(--chart-2))",
      },
      dailyPrecipitation: {
        label: "Daily Precipitation",
        color: "hsl(var(--chart-2))",
      },
      elevation: {
        label: "Survey Elevation",
        color: "hsl(var(--accent))",
      },
       operationalAction: {
        label: "Operational Action",
        color: "hsl(var(--chart-5))",
        icon: Settings,
      },
       "Permanent Pool": {
        label: "Permanent Pool",
        color: "hsl(210 40% 50%)",
      },
      temperature: {
        label: "Temperature",
        color: "hsl(var(--chart-3))",
        icon: Thermometer
      },
      sensorPressure: {
        label: "Sensor Pressure",
        color: "hsl(var(--chart-5))",
        icon: Gauge
      },
      barometer: {
        label: "Barometer",
        color: "hsl(var(--chart-4))",
        icon: Wind,
      }
    };
  
    asset.designElevations.forEach((de, index) => {
      const chartColorIndex = ((index + 2) % 5) + 1;
      config[de.name] = {
        label: de.name,
        color: `hsl(var(--chart-${chartColorIndex}))`
      };
    });
    
    return config;
  }, [asset.designElevations]);

  const yAxisBounds = React.useMemo(() => {
    if (loading) {
      return ['auto', 'auto'];
    }

    const dataToConsider = brushRange && brushRange.startIndex !== undefined && brushRange.endIndex !== undefined
      ? chartData.slice(brushRange.startIndex, brushRange.endIndex + 1)
      : chartData;

    const visibleDesignElevations = asset.designElevations.filter(de => visibleElevations[de.name]);

    if (dataToConsider.length === 0) {
       const assetElevations = [
        asset.permanentPoolElevation,
        ...visibleDesignElevations.filter(de => de.elevation > 0).map(de => de.elevation)
      ].filter(e => typeof e === 'number' && isFinite(e));
      
      if (assetElevations.length === 0) return [0, 1];

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
    visibleDesignElevations.filter(de => de.elevation > 0).forEach(de => {
        allElevations.push(de.elevation);
    });
    
    const validElevations = allElevations.filter(e => typeof e === 'number' && isFinite(e));
    if (validElevations.length === 0) {
        return [0, 1];
    }

    const dataMin = Math.min(...validElevations);
    const dataMax = Math.max(...validElevations);
    
    const padding = (dataMax - dataMin) * 0.1 || 1;

    return [dataMin - padding, dataMax + padding];
  }, [chartData, asset, loading, brushRange, visibleElevations]);

  const sensorDomains = React.useMemo(() => {
    const dataToConsider = brushRange && brushRange.startIndex !== undefined && brushRange.endIndex !== undefined
      ? chartData.slice(brushRange.startIndex, brushRange.endIndex + 1)
      : chartData;

    const getDomain = (key: keyof ChartablePoint) => {
        const values = dataToConsider.map(d => d[key]).filter(v => typeof v === 'number') as number[];
        if (values.length === 0) return ['auto', 'auto'];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const padding = (max - min) * 0.15 || 1;
        return [min - padding, max + padding];
    };

    return {
        temperature: getDomain('temperature'),
        sensorPressure: getDomain('sensorPressure'),
        barometer: getDomain('barometer'),
    };
  }, [chartData, brushRange]);


  React.useEffect(() => {
    if (!loading) {
      setYZoomRange(yAxisBounds as [number, number]);
    }
  }, [yAxisBounds, loading]);
  
  // Reset Y-axis zoom when the asset changes. The asset is the source of truth.
  React.useEffect(() => {
    setYZoomRange(yAxisBounds as [number, number]);
  }, [asset.id, yAxisBounds]);

  const handleResetView = () => {
    onBrushChange({});
    setYZoomRange(yAxisBounds as [number, number]);
  };
  
  const legendPayload = React.useMemo(() => {
    let payload = [
      { value: 'Water Elevation', type: 'line', id: 'waterLevel', dataKey: 'waterLevel', color: chartConfig.waterLevel.color },
      { value: 'Precipitation', type: 'rect', id: 'precipitation', dataKey: 'precipitation', color: chartConfig.precipitation.color },
      { value: 'Daily Precipitation', type: 'line', id: 'dailyPrecipitation', dataKey: 'dailyPrecipitation', color: chartConfig.dailyPrecipitation.color },
      { value: 'Survey Points', type: 'scatter', id: 'elevation', dataKey: 'elevation', color: chartConfig.elevation.color },
      { value: 'Operational Action', type: 'scatter', id: 'operationalAction', dataKey: 'operationalAction', color: chartConfig.operationalAction.color },
    ];
  
    if (visibleSensorData.temperature) payload.push({ value: 'Temperature', type: 'line', id: 'temperature', dataKey: 'temperature', color: chartConfig.temperature.color });
    if (visibleSensorData.sensorPressure) payload.push({ value: 'Sensor Pressure', type: 'line', id: 'sensorPressure', dataKey: 'sensorPressure', color: chartConfig.sensorPressure.color });
    if (visibleSensorData.barometer) payload.push({ value: 'Barometer', type: 'line', id: 'barometer', dataKey: 'barometer', color: chartConfig.barometer.color });

    const allDesignElevations = [
      { name: 'Permanent Pool', elevation: asset.permanentPoolElevation },
      ...asset.designElevations,
    ].sort((a, b) => a.elevation - b.elevation);

    const designPayload = allDesignElevations
        .filter(de => visibleElevations[de.name] || de.name === 'Permanent Pool')
        .map(de => ({
            value: de.name,
            type: 'line',
            id: de.name,
            dataKey: de.name,
            color: chartConfig[de.name]?.color,
        }));

    return [...payload, ...designPayload];
  }, [asset, chartConfig, visibleElevations, visibleSensorData]);


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
          <div className="h-[450px] flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
            <p>Loading chart data for {asset.name}...</p>
          </div>
        </CardContent>
      </Card>
    )
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
        <ChartContainer config={chartConfig} className="h-[450px] w-full flex-1">
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 50, left: 20, bottom: 90 }}
            syncMethod="index"
          >
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
              orientation="left"
              unit="m"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              type="number"
              domain={yZoomRange || yAxisBounds}
              tickFormatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
              allowDataOverflow={true}
            />
             <YAxis
              yAxisId="right"
              orientation="right"
              unit="mm"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              type="number"
              domain={[0, (dataMax: number) => Math.max(1, dataMax * 1.1)]}
              reversed={true}
              tickFormatter={(value) => (value as number).toFixed(0)}
            />
             <YAxis
              yAxisId="temp"
              orientation="right"
              unit="°C"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              type="number"
              domain={sensorDomains.temperature}
              hide={!visibleSensorData.temperature}
            />
             <YAxis
              yAxisId="pressure"
              orientation="right"
              unit="kPa"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              type="number"
              domain={sensorDomains.sensorPressure}
              hide={!visibleSensorData.sensorPressure}
            />
            <YAxis
              yAxisId="barometer"
              orientation="right"
              unit="kPa"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              type="number"
              domain={sensorDomains.barometer}
              hide={!visibleSensorData.barometer}
            />
            <ChartTooltip
              cursor={false}
              content={<CustomTooltipContent asset={asset} config={chartConfig} />}
            />
             <Area
              yAxisId="right"
              dataKey="dailyPrecipitation"
              type="step"
              fill="var(--color-dailyPrecipitation)"
              fillOpacity={0.2}
              stroke="var(--color-dailyPrecipitation)"
              strokeOpacity={0.4}
              strokeWidth={1}
              name="Daily Precipitation"
              isAnimationActive={false}
              dot={false}
              connectNulls
            />
            <Area
              yAxisId="left"
              dataKey="waterLevel"
              type="monotone"
              fill="var(--color-waterLevel)"
              fillOpacity={0.4}
              stroke="var(--color-waterLevel)"
              name="Water Elevation"
              connectNulls
              isAnimationActive={false}
              dot={false}
              stackId="a"
            />
             <Bar
              yAxisId="right"
              dataKey="precipitation"
              fill="hsl(var(--chart-2))"
              fillOpacity={0.8}
              stroke="hsl(var(--chart-2))"
              strokeWidth={1}
              name="Precipitation"
              isAnimationActive={false}
              stackId="b"
            />
            <Scatter 
              yAxisId="left"
              dataKey="elevation" 
              fill="var(--color-elevation)" 
              name="Survey Points"
              isAnimationActive={false}
            />
            <Scatter 
              yAxisId="left"
              dataKey="operationalAction" 
              fill="var(--color-operationalAction)" 
              name="Operational Action"
              isAnimationActive={false}
              shape="star"
            />

            {/* Sensor Data Lines */}
            {visibleSensorData.temperature && <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="var(--color-temperature)" dot={false} isAnimationActive={false} name="Temperature" />}
            {visibleSensorData.sensorPressure && <Line yAxisId="pressure" type="monotone" dataKey="sensorPressure" stroke="var(--color-sensorPressure)" dot={false} isAnimationActive={false} name="Sensor Pressure" />}
            {visibleSensorData.barometer && <Line yAxisId="barometer" type="monotone" dataKey="barometer" stroke="var(--color-barometer)" dot={false} isAnimationActive={false} name="Barometer" />}

            <ReferenceLine
              yAxisId="left"
              y={asset.permanentPoolElevation}
              stroke={chartConfig["Permanent Pool"].color}
              strokeWidth={2}
              isFront
            />
            {asset.designElevations.map(de => {
              if (visibleElevations[de.name]) {
                return (
                  <ReferenceLine
                    yAxisId="left"
                    key={de.name}
                    y={de.elevation}
                    stroke={chartConfig[de.name]?.color}
                    strokeDasharray="3 3"
                    isFront
                  />
                )
              }
              return null;
            })}
            <Brush 
                dataKey="timestamp" 
                height={30} 
                stroke="hsl(var(--chart-1))"
                tickFormatter={(value) => new Date(value as number).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                y={390}
                startIndex={brushRange?.startIndex}
                endIndex={brushRange?.endIndex}
                onChange={(range) => {
                    onBrushChange({startIndex: range.startIndex, endIndex: range.endIndex})
                }}
            />
             <Legend
              content={<CustomLegend chartConfig={chartConfig} />}
              verticalAlign="bottom"
              wrapperStyle={{ paddingTop: '20px' }}
              payload={legendPayload}
            />
          </ComposedChart>
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
                size="sm"
                onClick={handleResetView}
                disabled={loading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset View
              </Button>
             <Button 
                variant="outline"
                size="sm"
                onClick={() => setIsDataTableOpen(true)}
             >
                <TableIcon className="mr-2 h-4 w-4" />
                View Data
            </Button>
        </div>
        
        <Dialog open={isDataTableOpen} onOpenChange={setIsDataTableOpen}>
            <DialogContent className="sm:max-w-[725px]">
                <DialogHeader>
                    <DialogTitle>Chart Data for {asset.name}</DialogTitle>
                    <DialogDescription>
                        Raw data points being sent to the performance chart.
                    </DialogDescription>
                </DialogHeader>
                {chartData.length > 0 ? (
                    <ScrollArea className="h-[60vh] border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Water Elevation (m)</TableHead>
                                    <TableHead>Precipitation (mm)</TableHead>
                                    <TableHead>Survey Elevation (m)</TableHead>
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
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                       <BarChart className="mx-auto h-8 w-8 mb-2" />
                       <p>No data was sent to the chart component.</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
}

    
    