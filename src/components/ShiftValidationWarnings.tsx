import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ShiftValidationResult, ShiftViolation } from '@/types/shiftRules';
import { format } from 'date-fns';

interface ShiftValidationWarningsProps {
  result: ShiftValidationResult;
  compact?: boolean;
}

export function ShiftValidationWarnings({ result, compact = false }: ShiftValidationWarningsProps) {
  if (result.isValid && result.warnings.length === 0) {
    if (compact) return null;
    
    return (
      <Alert className="border-green-500/50 bg-green-500/10">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-green-600">All staffing requirements met</AlertTitle>
        <AlertDescription className="text-green-600/80">
          The roster meets all composition rules.
        </AlertDescription>
      </Alert>
    );
  }

  // Group violations by date
  const violationsByDate = result.violations.reduce((acc, v) => {
    if (!acc[v.date]) acc[v.date] = [];
    acc[v.date].push(v);
    return acc;
  }, {} as Record<string, ShiftViolation[]>);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle size={16} />
        <span className="text-sm font-medium">
          {result.violations.length} staffing shortage{result.violations.length > 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle size={20} />
          Staffing Shortages ({result.violations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-4">
            {Object.entries(violationsByDate).map(([date, violations]) => (
              <div key={date} className="space-y-2">
                <h4 className="font-medium text-sm">
                  {format(new Date(date), 'EEEE, MMM d')}
                </h4>
                <div className="space-y-1.5">
                  {violations.map((v, i) => (
                    <div 
                      key={i} 
                      className="flex items-center gap-2 text-sm p-2 rounded-md bg-destructive/10"
                    >
                      <AlertCircle size={14} className="text-destructive shrink-0" />
                      <span className="flex-1">{v.message}</span>
                      <Badge variant="outline" className="text-xs">
                        {v.actual}/{v.required}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <p className="text-sm text-muted-foreground mt-4">
          Publishing is blocked until all staffing requirements are met.
        </p>
      </CardContent>
    </Card>
  );
}

interface ShortagesSummaryProps {
  shortages: ShiftViolation[];
}

export function ShortagesSummary({ shortages }: ShortagesSummaryProps) {
  if (shortages.length === 0) return null;

  // Group by date
  const byDate = shortages.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {} as Record<string, ShiftViolation[]>);

  const dates = Object.keys(byDate).sort();

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        Unable to fill {shortages.length} position{shortages.length > 1 ? 's' : ''}
      </AlertTitle>
      <AlertDescription>
        <ScrollArea className="max-h-[200px] mt-2">
          <div className="space-y-2">
            {dates.slice(0, 5).map(date => (
              <div key={date} className="text-sm">
                <span className="font-medium">{format(new Date(date), 'MMM d')}:</span>{' '}
                {byDate[date].map(s => s.message).join(', ')}
              </div>
            ))}
            {dates.length > 5 && (
              <p className="text-sm text-muted-foreground">
                And {dates.length - 5} more dates with shortages...
              </p>
            )}
          </div>
        </ScrollArea>
      </AlertDescription>
    </Alert>
  );
}
