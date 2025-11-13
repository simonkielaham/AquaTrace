import type { AnalysisResult } from "@/lib/placeholder-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Info,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AnalysisResultsProps = {
  results: AnalysisResult[];
};

const iconMap = {
  high: <XCircle className="h-5 w-5 text-destructive" />,
  medium: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  low: <Info className="h-5 w-5 text-blue-500" />,
  info: <CheckCircle2 className="h-5 w-5 text-green-500" />,
};

const typeIconMap = {
  "Blocked Outlet": <XCircle className="h-4 w-4 text-muted-foreground" />,
  "Potential Leak": <Droplets className="h-4 w-4 text-muted-foreground" />,
  "Normal Drainage": <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
  "High Inflow": <Info className="h-4 w-4 text-muted-foreground" />,
};

const severityTextClass = {
  high: "text-destructive",
  medium: "text-yellow-600 dark:text-yellow-500",
  low: "text-blue-600 dark:text-blue-500",
  info: "text-green-600 dark:text-green-500",
};

export default function AnalysisResults({ results }: AnalysisResultsProps) {
  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm">
      <CardHeader>
        <CardTitle className="font-headline">Analysis Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.id} className="flex items-start space-x-4">
              <div className="flex-shrink-0 mt-1">{iconMap[result.severity]}</div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  {typeIconMap[result.type]}
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      severityTextClass[result.severity]
                    )}
                  >
                    {result.type}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {result.description}
                </p>
                <p className="text-xs text-muted-foreground/80 pt-1">
                  {new Date(result.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
