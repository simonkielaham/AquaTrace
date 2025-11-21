
"use client";

import type { Asset, ChartablePoint } from "@/lib/placeholder-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { BarChart, AreaChart as AreaChartIcon, Save, TableIcon, TrendingDown, TrendingUp } from "lucide-react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { ComposedChart, Area, CartesianGrid, XAxis, YAxis, ReferenceLine, Brush, Legend, Scatter, Bar } from "recharts";
import * as React from "react";
import { cn } from "@/lib/utils";

type PerformanceChartProps = {
  asset: Asset;
  chartData: ChartablePoint[];
  loading: boolean;
  brushRange?: { startIndex?: number; endIndex?: number };
  onBrushChange: (range: { startIndex?: number; endIndex?: number }) => void;
  visibleElevations: Record<string, boolean>;
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
    range: { startIndex?: number, endIndex?: number },
    isOpen: boolean,
    onOpenChange: (open: boolean) => void,
}) => {
    
    if (range.startIndex === undefined || range.endIndex === undefined) {
        return null;
    }
    
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


const CustomLegend = ({ payload, chartConfig }: { payload?: any[], chartConfig: any }) => {
  if (!payload) return null;

  const mainPayload = payload.filter(p => ["Water Elevation", "Precipitation", "Survey Points", "Daily Precipitation"].includes(p.value));
  const designPayload = payload.filter(p => !["Water Elevation", "Precipitation", "Survey Points", "Daily Precipitation"].includes(p.value));
  
  const renderLegendItems = (items: any[]) => (
    items.map((entry, index) => {
      const config = chartConfig[entry.value] || {};
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
                    {item.showSign && item.value > 0 ? '+' : ''}
                    {item.value.toFixed(2)}{item.unit}
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
}: PerformanceChartProps) {
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = React.useState(false);
  const [isDataTableOpen, setIsDataTableOpen] = React.useState(false);
  const [yZoomRange, setYZoomRange] = React.useState<[number, number] | null>(null);

  const chartConfig = React.useMemo(() => {
    const config: any = {
      waterLevel: {
        label: "Water Elevation",
        color: "hsl(var(--chart-1))",
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
       "Permanent Pool": {
        label: "Permanent Pool",
        color: "hsl(210 40% 50%)",
      },
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


  React.useEffect(() => {
    if (!loading) {
      setYZoomRange(yAxisBounds as [number, number]);
    }
  }, [yAxisBounds, loading]);
  
  const legendPayload = React.useMemo(() => {
    const mainPayload = [
      { value: 'Water Elevation', type: 'line', id: 'waterLevel', color: chartConfig.waterLevel.color },
      { value: 'Precipitation', type: 'rect', id: 'precipitation', color: chartConfig.precipitation.color },
      { value: 'Daily Precipitation', type: 'line', id: 'dailyPrecipitation', color: chartConfig.dailyPrecipitation.color },
      { value: 'Survey Points', type: 'scatter', id: 'elevation', color: chartConfig.elevation.color },
    ];
  
    const allDesignElevations = [
      { name: 'Permanent Pool', elevation: asset.permanentPoolElevation },
      ...asset.designElevations,
    ].sort((a, b) => a.elevation - b.elevation);

    const designPayload = allDesignElevations.map(de => ({
      value: de.name,
      type: 'line',
      id: de.name,
      color: chartConfig[de.name]?.color,
    }));

    return [...mainPayload, ...designPayload];
  }, [asset.designElevations, asset.permanentPoolElevation, chartConfig]);


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
          <div className="h-[450px] flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
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
        <ChartContainer config={chartConfig} className="h-[450px] w-full flex-1">
          <ComposedChart data={chartData} margin={{ top: 5, right: 50, left: 20, bottom: 90 }}>
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
              label={{ value: 'Water Elevation (m)', angle: -90, position: 'insideLeft', offset: -15 }}
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
              label={{ value: 'Precipitation (mm)', angle: 90, position: 'right', offset: 15 }}
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
            />
             <Bar
              yAxisId="right"
              dataKey="precipitation"
              fill="var(--color-precipitation)"
              fillOpacity={0.8}
              stroke="var(--color-precipitation)"
              strokeWidth={1}
              name="Precipitation"
              isAnimationActive={false}
            />
            <Scatter 
              yAxisId="left"
              dataKey="elevation" 
              fill="var(--color-elevation)" 
              name="Survey Points"
              isAnimationActive={false}
            />
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
                onClick={() => setIsDataTableOpen(true)}
             >
                <TableIcon className="mr-2 h-4 w-4" />
                View Data
            </Button>
             <Button 
                onClick={() => setIsAnalysisDialogOpen(true)}
                disabled={!brushRange || brushRange.startIndex === undefined || brushRange.endIndex === undefined}
             >
                <AreaChartIcon className="mr-2 h-4 w-4" />
                Analyze Selected Range
            </Button>
        </div>
        
        {brushRange && <AnalysisDialog 
            asset={asset}
            isOpen={isAnalysisDialogOpen}
            onOpenChange={setIsAnalysisDialogOpen}
            data={chartData}
            range={brushRange}
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
