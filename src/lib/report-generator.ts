
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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


export const generateReport = async (data: ReportData, onProgress: ProgressCallback) => {
  const { asset, deployments, chartData, weatherSummary, overallAnalysis } = data;
  const reviewedEvents = (weatherSummary?.events || []).filter(e => !e.analysis?.disregarded);

  onProgress("Initializing PDF document...");
  const doc = new jsPDF("p", "mm", "a4");
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = margin;

  const addHeader = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, margin, yPos);
    yPos += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;
  };

  const addSubheader = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin, yPos);
    yPos += 6;
  }
  
  const addText = (text: string, indent = 0) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(text, pageWidth - margin * 2 - indent);
      doc.text(splitText, margin + indent, yPos);
      yPos += (splitText.length * 4) + 4;
      if (yPos > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
      }
  }

  const addField = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(label, margin, yPos);
      doc.setFont("helvetica", "normal");
      const valueX = margin + 50;
      const splitValue = doc.splitTextToSize(value, pageWidth - valueX - margin);
      doc.text(splitValue, valueX, yPos);
      yPos += (splitValue.length * 4) + 2;
       if (yPos > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
      }
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

  addSubheader("Assessment Details");
  addField("Permanent Pool Performance:", formatText(overallAnalysis.permanentPoolPerformance?.replace(/_/g, ' ')).replace(/\b\w/g, l => l.toUpperCase()));
  addField("Estimated Control Elevation:", `${formatNumber(overallAnalysis.estimatedControlElevation)} m`);
  addField("Response to Rain Events:", formatText(overallAnalysis.rainResponse?.replace(/_/g, ' ')).replace(/\b\w/g, l => l.toUpperCase()));
  addField("Further Investigation:", formatText(overallAnalysis.furtherInvestigation?.replace(/_/g, ' ')).replace(/\b\w/g, l => l.toUpperCase()));
  
  yPos += 10;
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
  const chartElement = document.getElementById('performance-chart-container-for-report');
  if (!chartElement) {
      throw new Error("Chart container for report not found. This is an internal error.");
  }
  
  for (const [index, event] of reviewedEvents.entries()) {
    onProgress(`Processing event ${index + 1} of ${reviewedEvents.length}...`);
    doc.addPage();
    yPos = margin;
    addHeader(`Precipitation Event: ${format(new Date(event.startDate), "Pp")}`);
    
    // Dispatch a custom event to tell the chart to re-render for this event's timeframe
    const renderEvent = new CustomEvent('render-chart-for-report', {
        detail: { 
            startDate: event.startDate, 
            endDate: event.endDate + (48 * 60 * 60 * 1000)
        }
    });
    chartElement.dispatchEvent(renderEvent);

    // Wait for the chart to render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onProgress(`Capturing chart for event ${index + 1}...`);
    const canvas = await html2canvas(chartElement, {
        logging: false,
        useCORS: true,
        scale: 2, // Higher scale for better quality
    });
    const imgData = canvas.toDataURL("image/png");
    
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    doc.addImage(imgData, "PNG", margin, yPos, imgWidth, imgHeight);
    yPos += imgHeight + 10;

    if (yPos > pageHeight - margin - 60) { // Check if there's enough space for details
      doc.addPage();
      yPos = margin;
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
