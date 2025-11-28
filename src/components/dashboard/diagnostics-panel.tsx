
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, Lightbulb, AlertTriangle, CheckCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiagnosticsPanelProps {
  diagnostics: any | null;
}

const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.7) return "bg-destructive";
    if (confidence > 0.5) return "bg-orange-500";
    return "bg-yellow-500";
}

const getConfidenceIcon = (confidence: number) => {
    if (confidence > 0.7) return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (confidence > 0.5) return <Lightbulb className="h-4 w-4 text-orange-500" />;
    return <Search className="h-4 w-4 text-yellow-500" />;
}

export default function DiagnosticsPanel({ diagnostics }: DiagnosticsPanelProps) {
    if (!diagnostics || Object.keys(diagnostics).length === 0) {
        return null; // Don't render the card if there's nothing to show
    }

    const allDiagnoses = Object.entries(diagnostics)
        .flatMap(([eventId, eventDiagnoses]: [string, any]) =>
            Array.isArray(eventDiagnoses) ? eventDiagnoses.map(d => ({ ...d, eventId })) : []
        )
        .filter(d => d.confidence > 0)
        .sort((a,b) => b.confidence - a.confidence);

    const topDiagnosis = allDiagnoses[0];
    
  return (
    <Card className="col-span-1 lg:col-span-4 shadow-sm">
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="p-6">
            <div className="flex items-start gap-4 text-left">
                {topDiagnosis ? getConfidenceIcon(topDiagnosis.confidence) : <CheckCircle className="h-6 w-6 text-green-500" />}
              <div>
                <CardTitle className="font-headline text-2xl">
                  Automated Diagnostics
                </CardTitle>
                <CardDescription className="mt-1">
                  {topDiagnosis ? `Top finding: ${topDiagnosis.title} (Confidence: ${(topDiagnosis.confidence * 100).toFixed(0)}%)` : "No significant issues detected based on the current ruleset."}
                </CardDescription>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
          </AccordionTrigger>
          <AccordionContent>
            <CardContent>
                {allDiagnoses.length > 0 ? (
                    <div className="space-y-4">
                        {allDiagnoses.map((diag, index) => (
                             <div key={index} className="p-4 border rounded-lg">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-semibold">{diag.title}</h4>
                                    <Badge variant={diag.confidence > 0.7 ? "destructive" : diag.confidence > 0.5 ? "secondary" : "outline"}>
                                        Confidence: {(diag.confidence * 100).toFixed(0)}%
                                    </Badge>
                                </div>
                                <Progress value={diag.confidence * 100} className={cn("h-2 mt-2", getConfidenceColor(diag.confidence))} />
                                <p className="text-xs text-muted-foreground mt-1">Event ID: {diag.eventId}</p>
                                
                                <p className="text-sm mt-3 text-muted-foreground">
                                    <span className="font-semibold text-foreground">Things to investigate: </span>{diag.investigation}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p>No issues identified by the automated rules engine.</p>
                    </div>
                )}
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
