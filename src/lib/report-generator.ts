

import jsPDF from "jspdf";
import { format } from "date-fns";
import {
  Asset,
  Deployment,
  ChartablePoint,
  WeatherSummary,
  OverallAnalysisData,
  AnalysisPeriod,
} from "@/lib/placeholder-data";

interface ReportData {
  asset: Asset;
  deployments: Deployment[];
  chartData: ChartablePoint[];
  weatherSummary: WeatherSummary | null;
  overallAnalysis: OverallAnalysisData;
}

type ProgressCallback = (message: string) => void;

// Helper function to format text for the PDF
const formatText = (text?: string | null) => text || "N/A";

// Helper function to format numbers
const formatNumber = (num?: number | null, decimals = 2) =>
  typeof num === "number" ? num.toFixed(decimals) : "N/A";

// --- START: PDF Chart Drawing Logic ---

interface ChartBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minPrecip: number;
  maxPrecip: number;
}

interface ChartDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

function calculateBounds(
  data: ChartablePoint[],
  asset: Asset
): ChartBounds {
  const elevations = data
    .map((d) => d.waterLevel)
    .filter((v): v is number => typeof v === 'number');
  
  const precipitations = data
    .map((d) => d.precipitation)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  
  const designElevations = asset.designElevations.map(de => de.elevation);
  
  const allElevations = [...elevations, asset.permanentPoolElevation, ...designElevations];

  const validElevations = allElevations.filter(e => typeof e === 'number');
  
  const minY = validElevations.length > 0 ? Math.min(...validElevations) - 0.2 : 0;
  const maxY = validElevations.length > 0 ? Math.max(...validElevations) + 0.2 : 1;


  return {
    minX: data[0]?.timestamp,
    maxX: data[data.length - 1]?.timestamp,
    minY: minY,
    maxY: maxY,
    minPrecip: 0,
    maxPrecip: precipitations.length > 0 ? Math.max(1, ...precipitations) : 1,
  };
}

function drawChart(
  doc: jsPDF,
  data: ChartablePoint[],
  asset: Asset,
  dims: ChartDimensions
) {
  if (data.length < 2) return;

  const bounds = calculateBounds(data, asset);

  const scaleX = (val: number) => dims.x + ((val - bounds.minX) / (bounds.maxX - bounds.minX)) * dims.width;
  const scaleY = (val: number) => dims.y + dims.height - ((val - bounds.minY) / (bounds.maxY - bounds.minY)) * dims.height;
  const scalePrecip = (val: number) => ((val - bounds.minPrecip) / (bounds.maxPrecip - bounds.minPrecip)) * (dims.height / 3);

  // Draw Grid & Axes
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  const yAxisTicks = 5;
  for (let i = 0; i <= yAxisTicks; i++) {
    const val = bounds.minY + (i / yAxisTicks) * (bounds.maxY - bounds.minY);
    const y = scaleY(val);
    doc.line(dims.x, y, dims.x + dims.width, y);
    doc.setFontSize(7);
    doc.text(`${val.toFixed(2)}m`, dims.x - 2, y + 2, { align: 'right' });
  }
  const precipTicks = 3;
  for (let i = 0; i <= precipTicks; i++) {
    const val = bounds.minPrecip + (i/precipTicks) * bounds.maxPrecip;
    const y = dims.y + dims.height - scalePrecip(val);
     doc.setFontSize(7);
     doc.setTextColor(100, 100, 255);
     doc.text(`${val.toFixed(1)}mm`, dims.x + dims.width + 2, y + 2, { align: 'left' });
  }
  doc.setTextColor(0,0,0);

  // Draw Water Level Area
  doc.setFillColor(120, 150, 180);
  doc.setDrawColor(120, 150, 180);
  doc.setLineWidth(0.3);
  const waterLevelPoints: [number, number][] = [];
  data.forEach(p => {
    if (typeof p.waterLevel === 'number') {
      waterLevelPoints.push([scaleX(p.timestamp), scaleY(p.waterLevel)]);
    }
  });

  if (waterLevelPoints.length > 1) {
    const fillPath: [number, number][] = [];
    const baselineY = dims.y + dims.height;
    
    // Start from baseline at the first point's X
    fillPath.push([waterLevelPoints[0][0], baselineY]);
    
    // Add all the water level points
    fillPath.push(...waterLevelPoints);
    
    // End at baseline at the last point's X
    fillPath.push([waterLevelPoints[waterLevelPoints.length - 1][0], baselineY]);

    doc.path(fillPath).fill();
  }


  // Draw Precipitation Bars
  doc.setFillColor(100, 100, 255);
  const barWidth = Math.max(1, dims.width / data.length * 0.8);
  data.forEach(p => {
    if (typeof p.precipitation === 'number' && p.precipitation > 0) {
      const precipHeight = scalePrecip(p.precipitation);
      if (precipHeight > 0) {
        const x = scaleX(p.timestamp) - barWidth/2;
        const y = dims.y + dims.height - precipHeight;
        doc.rect(x, y, barWidth, precipHeight, "F");
      }
    }
  });

  // Draw Reference Lines
  const allDesignElevations = [
      { name: 'Permanent Pool', elevation: asset.permanentPoolElevation, color: [6, 78, 59], dash: undefined },
      ...asset.designElevations.map(de => ({ ...de, color: [199, 2, 2], dash: [2, 2] as [number, number] }))
  ];

  allDesignElevations.forEach(de => {
    if(typeof de.elevation !== 'number') return;
    const y = scaleY(de.elevation);
    doc.setDrawColor(de.color[0], de.color[1], de.color[2]);
    doc.setLineWidth(0.5);
    if(de.dash) doc.setLineDashPattern(de.dash, 0);
    doc.line(dims.x, y, dims.x + dims.width, y);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7);
    doc.text(de.name, dims.x + dims.width + 15, y + 1.5, { align: 'left'});
  });
  doc.setDrawColor(0,0,0);
}

// --- END: PDF Chart Drawing Logic ---

export const generateReport = async (data: ReportData, onProgress: ProgressCallback) => {
  const { asset, deployments, chartData, weatherSummary, overallAnalysis } = data;
  const reviewedEvents = (weatherSummary?.events || []).filter(e => !e.analysis?.disregarded);

  onProgress("Initializing PDF document...");
  const doc = new jsPDF("p", "mm", "a4");
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = margin;

  const checkPageBreak = (heightNeeded: number) => {
    if (yPos + heightNeeded > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
  }

  const addHeader = (title: string) => {
    checkPageBreak(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, margin, yPos);
    yPos += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  };

  const addSubheader = (title: string) => {
    checkPageBreak(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin, yPos);
    yPos += 6;
  }
  
  const addText = (text: string, indent = 0) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(text, pageWidth - margin * 2 - indent);
    const textHeight = doc.getTextDimensions(splitText).h;
    checkPageBreak(textHeight + 2);
    doc.text(splitText, margin + indent, yPos);
    yPos += textHeight + 2;
  }

  const addField = (label: string, value: string) => {
      const labelWidth = doc.getTextDimensions(label, { font: doc.getFont('helvetica', 'bold') }).w;
      const valueX = margin + labelWidth + 2;
      const splitValue = doc.splitTextToSize(value, pageWidth - valueX - margin);
      const fieldHeight = doc.getTextDimensions(splitValue).h;
      checkPageBreak(fieldHeight + 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(label, margin, yPos);

      doc.setFont("helvetica", "normal");
      doc.text(splitValue, valueX, yPos);
      yPos += fieldHeight + 2;
  }

  // --- 1. Title Page ---
  onProgress("Creating title page...");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(asset.name, pageWidth / 2, pageHeight / 3, { align: "center" });

  doc.setFontSize(18);
  doc.text("Stormwater Management Facility Performance Report", pageWidth / 2, pageHeight / 3 + 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Location: ${asset.location}`, pageWidth / 2, pageHeight / 2 + 10, { align: "center" });
  doc.text(`Generated: ${format(new Date(), "PPP")}`, pageWidth / 2, pageHeight / 2 + 20, { align: "center" });
  doc.text(`By: ${overallAnalysis.analystInitials}`, pageWidth / 2, pageHeight / 2 + 30, { align: "center" });
  
  // --- 2. Summary Page ---
  doc.addPage();
  yPos = margin;
  addHeader("Overall Asset Analysis");

  addSubheader("Summary");
  addText(formatText(overallAnalysis.summary));
  yPos+=4;

  addSubheader("Assessment Details");
  addField("Permanent Pool Performance:", formatText(overallAnalysis.permanentPoolPerformance?.replace(/_/g, ' ')).replace(/\b\w/g, l => l.toUpperCase()));
  addField("Estimated Control Elevation:", `${formatNumber(overallAnalysis.estimatedControlElevation)} m`);
  addField("Response to Rain Events:", formatText(overallAnalysis.rainResponse?.replace(/_/g, ' ')).replace(/\b\w/g, l => l.toUpperCase()));
  addField("Further Investigation:", formatText(overallAnalysis.furtherInvestigation?.replace(/_/g, ' ')).replace(/\b\w/g, l => l.toUpperCase()));
  yPos+=4;
  
  addSubheader("Asset Details");
  addField("Asset ID:", asset.id);
  addField("Location:", `${asset.latitude.toFixed(4)}, ${asset.longitude.toFixed(4)}`);
  addField("Permanent Pool Elevation:", `${formatNumber(asset.permanentPoolElevation)} m`);

  if(deployments.length > 0) {
    yPos += 5;
    addSubheader("Deployments");
    deployments.forEach(d => {
       addText(`- ${d.name || d.sensorId}: Sensor Elevation ${formatNumber(d.sensorElevation)}m, Stillwell Top ${formatNumber(d.stillwellTop)}m`, 5);
    });
  }

  // --- 3. Event Pages ---
  for (const [index, event] of reviewedEvents.entries()) {
    onProgress(`Processing event ${index + 1} of ${reviewedEvents.length}...`);
    doc.addPage();
    yPos = margin;
    addHeader(`Precipitation Event: ${format(new Date(event.startDate), "Pp")}`);
    
    // Define chart dimensions
    const chartDims: ChartDimensions = {
        x: margin,
        y: yPos,
        width: pageWidth - margin * 2 - 25, // leave space for labels
        height: 60
    };
    
    checkPageBreak(chartDims.height + 10);

    const eventStartDate = event.startDate;
    const eventEndDate = event.endDate + (48 * 60 * 60 * 1000);
    const eventData = chartData.filter(d => d.timestamp >= eventStartDate && d.timestamp <= eventEndDate);
    
    if(eventData.length > 1) {
        drawChart(doc, eventData, asset, chartDims);
        yPos += chartDims.height + 15;
    } else {
        addText("Not enough data to render a chart for this event period.");
    }
    
    addSubheader("Event Summary");
    addField("Event Duration:", formatText(event.analysis?.timeToBaseline));
    addField("Total Precipitation:", `${formatNumber(event.totalPrecipitation)} mm`);

    yPos += 5;
    addSubheader("Performance Analysis");
    addField("Baseline Elevation:", `${formatNumber(event.analysis?.baselineElevation)} m`);
    addField("Peak Elevation:", `${formatNumber(event.analysis?.peakElevation)} m`);
    addField("Post-Event Elevation:", `${formatNumber(event.analysis?.postEventElevation)} m`);
    addField("Drawdown Analysis:", formatText(event.analysis?.drawdownAnalysis));
    
    yPos += 5;
    addSubheader("Analyst Review");
    addField("Status:", formatText(event.analysis?.status?.replace(/_/g, ' ')).replace(/\b\w/g, l => l.toUpperCase()));
    addText(formatText(event.analysis?.notes));
    yPos += 2;
    addField("Signed Off By:", formatText(event.analysis?.analystInitials));
  }

  onProgress("Finalizing PDF...");
  const filename = `${asset.name.replace(/\s+/g, '_')}_Performance_Report.pdf`;
  doc.save(filename);
};
