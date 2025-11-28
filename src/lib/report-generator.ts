

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
import { DiagnosticResult } from "./diagnostics/rules-engine";

interface ReportData {
  asset: Asset;
  deployments: Deployment[];
  chartData: ChartablePoint[];
  weatherSummary: WeatherSummary | null;
  overallAnalysis: OverallAnalysisData;
  diagnostics: { [eventId: string]: DiagnosticResult[] } | null;
}

type ProgressCallback = (message: string) => void;

// --- START: PDF Styling and Layout Constants ---

const HamiltonColors = {
  blue: '#005596',
  green: '#008755',
  darkGrey: '#414141',
  lightGrey: '#EAEAEA',
  white: '#FFFFFF',
  background: '#F0F4F7'
};

const PAGE_MARGIN = 15;
const FONT_BODY = "helvetica";
const FONT_HEADLINE = "helvetica"; // jsPDF supports limited fonts, using helvetica for both

// --- END: PDF Styling and Layout Constants ---


// Helper function to format text for the PDF
const formatText = (text?: string | null) => text || "N/A";

// Helper function to format numbers
const formatNumber = (num?: number | null, decimals = 2) =>
  typeof num === 'number' ? num.toFixed(decimals) : "N/A";

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
  
  const allElevations = [...elevations, asset.permanentPoolElevation];

  const validElevations = allElevations.filter(e => typeof e === 'number' && isFinite(e));
  
  let minY = 0, maxY = 1;
  if (validElevations.length > 0) {
      minY = Math.min(...validElevations);
      maxY = Math.max(...validElevations);
  }
  
  const yPadding = (maxY - minY) * 0.1 > 0 ? (maxY - minY) * 0.1 : 0.2;
  minY -= yPadding;
  maxY += yPadding;


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
  dims: ChartDimensions,
  eventsToAnnotate?: AnalysisPeriod[]
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
  doc.setFontSize(7);
  doc.setTextColor(HamiltonColors.darkGrey);
  for (let i = 0; i <= yAxisTicks; i++) {
    const val = bounds.minY + (i / yAxisTicks) * (bounds.maxY - bounds.minY);
    const y = scaleY(val);
    doc.line(dims.x, y, dims.x + dims.width, y);
    doc.text(`${val.toFixed(2)}m`, dims.x - 2, y + 2, { align: 'right' });
  }

  const precipTicks = 3;
  for (let i = 0; i <= precipTicks; i++) {
    const val = bounds.minPrecip + (i/precipTicks) * bounds.maxPrecip;
    const y = dims.y + dims.height - scalePrecip(val);
     doc.setFontSize(7);
     doc.setTextColor(HamiltonColors.blue);
     doc.text(`${val.toFixed(1)}mm`, dims.x + dims.width + 2, y + 2, { align: 'left' });
  }
  doc.setTextColor(HamiltonColors.darkGrey);
  
  // Draw X-Axis Labels
  doc.setFontSize(7);
  const xAxisTicks = 4;
  for (let i = 0; i <= xAxisTicks; i++) {
      const timestamp = bounds.minX + (i / xAxisTicks) * (bounds.maxX - bounds.minX);
      const x = scaleX(timestamp);
      doc.text(format(new Date(timestamp), 'M/d HH:mm'), x, dims.y + dims.height + 5, { align: 'center'});
  }

  // Draw Water Level Line
  const waterLevelPoints = data
    .map(p => (typeof p.waterLevel === 'number' ? {x: scaleX(p.timestamp), y: scaleY(p.waterLevel)} : null))
    .filter((p): p is {x: number, y: number} => p !== null);

  if (waterLevelPoints.length > 1) {
    doc.setDrawColor(HamiltonColors.green);
    doc.setLineWidth(0.5);
    doc.moveTo(waterLevelPoints[0].x, waterLevelPoints[0].y);
    for (let i = 1; i < waterLevelPoints.length; i++) {
        doc.lineTo(waterLevelPoints[i].x, waterLevelPoints[i].y);
    }
    doc.stroke(); // Render the path
  }

  // Draw Precipitation Bars
  doc.setFillColor(HamiltonColors.blue);
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
  const permanentPool = { name: 'Permanent Pool', elevation: asset.permanentPoolElevation };
  
  if(typeof permanentPool.elevation === 'number') {
    const y = scaleY(permanentPool.elevation);
    doc.setDrawColor(HamiltonColors.blue);
    doc.setLineWidth(0.5);
    doc.line(dims.x, y, dims.x + dims.width, y);
    doc.setFontSize(7);
    doc.text(permanentPool.name, dims.x + dims.width + 17, y + 1.5, { align: 'left'});
  }
  doc.setDrawColor(HamiltonColors.darkGrey);

  // Draw Event Annotations
  if (eventsToAnnotate) {
    eventsToAnnotate.forEach((event, index) => {
        const x = scaleX(event.startDate);
        const y = dims.y - 8;
        
        doc.setFillColor(HamiltonColors.darkGrey);
        doc.setDrawColor(HamiltonColors.darkGrey);
        doc.setLineWidth(0.3);

        // Arrow
        doc.line(x, y + 6, x, y + 2); // shaft
        doc.triangle(x - 1, y + 2, x + 1, y + 2, x, y, 'F'); // head

        // Numbered Circle
        doc.circle(x, y - 2.5, 2.5, 'F');
        doc.setFontSize(8);
        doc.setTextColor(HamiltonColors.white);
        doc.setFont(FONT_BODY, 'bold');
        doc.text(`${index + 1}`, x, y - 1, { align: 'center' });
    });
    doc.setTextColor(HamiltonColors.darkGrey);
    doc.setFont(FONT_BODY, 'normal');
  }
}

// --- END: PDF Chart Drawing Logic ---

export const generateReport = async (data: ReportData, onProgress: ProgressCallback) => {
  const { asset, deployments, chartData, weatherSummary, overallAnalysis, diagnostics } = data;
  const reviewedEvents = (weatherSummary?.events || []).filter(e => !e.analysis?.disregarded);

  onProgress("Initializing PDF document...");
  const doc = new jsPDF("p", "mm", "a4");
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = PAGE_MARGIN;
  
  let toc: { title: string, page: number }[] = [];

  const addPageHeaderAndFooter = (pageTitle: string) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        // Header
        doc.setFillColor(HamiltonColors.blue);
        doc.rect(0, 0, pageWidth, 10, 'F');
        doc.setFont(FONT_HEADLINE, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(HamiltonColors.white);
        doc.text(pageTitle, PAGE_MARGIN, 7);

        // Footer
        doc.setFont(FONT_BODY, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(HamiltonColors.darkGrey);
        const footerText = `Page ${i} of ${pageCount}`;
        doc.text(footerText, pageWidth / 2, pageHeight - 7, { align: 'center' });
    }
  };

  const checkPageBreak = (heightNeeded: number) => {
    if (yPos + heightNeeded > pageHeight - (PAGE_MARGIN + 10)) { // Adjust for footer
      doc.addPage();
      yPos = PAGE_MARGIN + 10; // Adjust for header
      return true;
    }
    return false;
  }

  const addSectionHeader = (title: string, addToc = false) => {
    // This check MUST happen first.
    if (checkPageBreak(16)) {
        // If a page break happened, the previous section header might have been the last thing on the page.
        // This is generally okay, but we ensure yPos is reset.
    }
    
    if (addToc) {
        toc.push({ title: title, page: doc.internal.getNumberOfPages() });
    }
    doc.setFont(FONT_HEADLINE, "bold");
    doc.setFontSize(16);
    doc.setTextColor(HamiltonColors.blue);
    doc.text(title, PAGE_MARGIN, yPos);
    yPos += 8;
    doc.setDrawColor(HamiltonColors.lightGrey);
    doc.setLineWidth(0.5);
    doc.line(PAGE_MARGIN, yPos, pageWidth - PAGE_MARGIN, yPos);
    yPos += 8;
    doc.setTextColor(HamiltonColors.darkGrey);
  };

  const addSubheader = (title: string) => {
    checkPageBreak(12);
    doc.setFont(FONT_HEADLINE, "bold");
    doc.setFontSize(12);
    doc.setTextColor(HamiltonColors.darkGrey);
    doc.text(title, PAGE_MARGIN, yPos);
    yPos += 7;
  }
  
  const addText = (text: string, indent = 0) => {
    doc.setFont(FONT_BODY, "normal");
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(text, pageWidth - PAGE_MARGIN * 2 - indent);
    const textHeight = doc.getTextDimensions(splitText).h;
    checkPageBreak(textHeight + 2);
    doc.text(splitText, PAGE_MARGIN + indent, yPos);
    yPos += textHeight + 2;
  }

  const addField = (label: string, value: string, yOffset?: number) => {
      const y = yOffset || yPos;
      doc.setFontSize(10);
      const labelWidth = doc.getTextDimensions(label, { font: doc.getFont(FONT_BODY, 'bold') }).w;
      const valueX = PAGE_MARGIN + labelWidth + 3;
      const splitValue = doc.splitTextToSize(value, pageWidth - valueX - PAGE_MARGIN);
      const fieldHeight = doc.getTextDimensions(splitValue).h;

      if (!yOffset) checkPageBreak(fieldHeight + 2);
      
      doc.setFont(FONT_BODY, "bold");
      doc.text(label, PAGE_MARGIN, y);

      doc.setFont(FONT_BODY, "normal");
      doc.text(splitValue, valueX, y);
      
      if (!yOffset) yPos += fieldHeight + 2;
      return fieldHeight;
  }

  // --- 1. Title Page ---
  onProgress("Creating title page...");
  doc.setFillColor(HamiltonColors.background);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(HamiltonColors.blue);
  doc.rect(0, pageHeight / 3 - 20, pageWidth, 50, 'F');

  doc.setFont(FONT_HEADLINE, "bold");
  doc.setFontSize(24);
  doc.setTextColor(HamiltonColors.white);
  doc.text(asset.name, pageWidth / 2, pageHeight / 3, { align: "center" });

  doc.setFontSize(18);
  doc.setTextColor(HamiltonColors.white);
  doc.text("Stormwater Management Facility Performance Report", pageWidth / 2, pageHeight / 3 + 10, { align: "center" });
  
  doc.setFont(FONT_BODY, "normal");
  doc.setFontSize(12);
  doc.setTextColor(HamiltonColors.darkGrey);

  const dataStartDate = chartData.length > 0 ? format(new Date(chartData[0].timestamp), "PPP") : 'N/A';
  const dataEndDate = chartData.length > 0 ? format(new Date(chartData[chartData.length - 1].timestamp), "PPP") : 'N/A';

  doc.text(`Location: ${asset.location}`, pageWidth / 2, pageHeight / 2 + 20, { align: "center" });
  doc.text(`Data Period: ${dataStartDate} to ${dataEndDate}`, pageWidth / 2, pageHeight / 2 + 30, { align: "center" });
  doc.text(`Report Date: ${format(new Date(), "PPP")}`, pageWidth / 2, pageHeight / 2 + 40, { align: "center" });
  doc.text(`Analyst: ${overallAnalysis.analystInitials}`, pageWidth / 2, pageHeight / 2 + 50, { align: "center" });
  
  // TOC placeholder, will be filled later
  const tocPage = 2;
  
  // --- 3. Summary Statistics Page ---
  onProgress("Creating summary statistics page...");
  doc.addPage();
  yPos = PAGE_MARGIN + 10;
  addSectionHeader("Summary Statistics", true);
  
  // Analysis counts
  const statusCounts = reviewedEvents.reduce((acc, event) => {
    const status = event.analysis?.drawdownAnalysis || 'Incomplete';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Diagnostics counts
  const diagnosticCounts = Object.values(diagnostics || {})
    .flat()
    .reduce((acc, diag) => {
      acc[diag.title] = (acc[diag.title] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  addSubheader("Deployment Hydrograph Overview");
  const overviewChartDims: ChartDimensions = {
      x: PAGE_MARGIN,
      y: yPos,
      width: pageWidth - PAGE_MARGIN * 2 - 25,
      height: 70
  };
  checkPageBreak(overviewChartDims.height + 15);
  drawChart(doc, chartData, asset, overviewChartDims, reviewedEvents);
  yPos += overviewChartDims.height + 15;

  addSubheader("Event Overview");
  addField("Total Reviewed Events:", `${reviewedEvents.length}`);
  yPos += 5;

  addSubheader("Manual Analysis Breakdown");
  Object.entries(statusCounts).forEach(([status, count]) => {
      addField(`${status}:`, `${count} event(s)`);
  });
  yPos += 5;

  addSubheader("Automated Diagnostics Breakdown");
  if(Object.keys(diagnosticCounts).length > 0) {
    Object.entries(diagnosticCounts).forEach(([title, count]) => {
        addField(`${title}:`, `${count} event(s)`);
    });
  } else {
    addText("No automated diagnostic flags were raised for any event.");
  }


  // --- 4. Event Pages ---
  for (const [index, event] of reviewedEvents.entries()) {
    onProgress(`Processing event ${index + 1} of ${reviewedEvents.length}...`);
    checkPageBreak(pageHeight); // checkPageBreak with a large value will always add a new page.
    yPos = PAGE_MARGIN + 10;
    addSectionHeader(`Event ${index + 1}: ${format(new Date(event.startDate), "Pp")}`, true);
    
    const chartDims: ChartDimensions = {
        x: PAGE_MARGIN,
        y: yPos,
        width: pageWidth - PAGE_MARGIN * 2 - 25,
        height: 60
    };
    
    checkPageBreak(chartDims.height + 15);

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
    
    const eventDiagnostics = diagnostics ? diagnostics[event.id] : [];
    if(eventDiagnostics && eventDiagnostics.length > 0) {
        addSubheader("Automated Diagnostics");
        eventDiagnostics.forEach(diag => {
            addText(`- ${diag.title} (Confidence: ${(diag.confidence * 100).toFixed(0)}%)`, 5);
        });
        yPos += 5;
    }
    
    addSubheader("Analyst Review");
    addField("Status:", formatText(event.analysis?.status?.replace(/_/g, ' ')).replace(/\b\w/g, l => l.toUpperCase()));
    addText(formatText(event.analysis?.notes));
    yPos += 2;
    addField("Signed Off By:", formatText(event.analysis?.analystInitials));
  }
  
  // --- 2. Index Page (after all pages are created) ---
  onProgress("Creating index page...");
  doc.insertPage(tocPage);
  doc.setPage(tocPage);
  yPos = PAGE_MARGIN + 10;
  addSectionHeader("Index");
  
  toc.forEach(item => {
      doc.setFontSize(12);
      const titleWidth = doc.getTextDimensions(item.title).w;
      const dots = ".".repeat(Math.max(0, Math.floor((pageWidth - PAGE_MARGIN * 2 - titleWidth - 10) / 1.1)));
      checkPageBreak(8);
      doc.text(item.title, PAGE_MARGIN, yPos);
      doc.text(dots, PAGE_MARGIN + titleWidth, yPos, { align: 'left'});
      doc.text(String(item.page), pageWidth - PAGE_MARGIN, yPos, { align: 'right'});
      yPos += 8;
  });

  // --- Add Page Numbers & Headers ---
  onProgress("Adding page numbers and headers...");
  addPageHeaderAndFooter(`Performance Report: ${asset.name}`);

  onProgress("Finalizing PDF...");
  const filename = `${asset.name.replace(/\s+/g, '_')}_Performance_Report.pdf`;
  doc.save(filename);
};

