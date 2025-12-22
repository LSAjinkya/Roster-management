import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar, Loader2 } from 'lucide-react';

interface LeaveCounts {
  weekOff: number;
  publicOff: number;
  compOff: number;
  paidLeave: number;
}

export function LeaveSummaryWidget() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthName = format(now, 'MMMM yyyy');

  const { data: leaveCounts, isLoading } = useQuery({
    queryKey: ['leave-summary', format(monthStart, 'yyyy-MM-dd')],
    queryFn: async (): Promise<LeaveCounts> => {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('shift_type')
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'))
        .in('shift_type', ['week-off', 'public-off', 'comp-off', 'paid-leave']);

      if (error) throw error;

      const counts: LeaveCounts = {
        weekOff: 0,
        publicOff: 0,
        compOff: 0,
        paidLeave: 0,
      };

      (data || []).forEach((assignment) => {
        switch (assignment.shift_type) {
          case 'week-off':
            counts.weekOff++;
            break;
          case 'public-off':
            counts.publicOff++;
            break;
          case 'comp-off':
            counts.compOff++;
            break;
          case 'paid-leave':
            counts.paidLeave++;
            break;
        }
      });

      return counts;
    },
  });

  const leaveTypes = [
    { label: 'OFF', name: 'Week Off', count: leaveCounts?.weekOff || 0, bgClass: 'bg-muted', textClass: 'text-muted-foreground' },
    { label: 'PO', name: 'Public Holiday', count: leaveCounts?.publicOff || 0, bgClass: 'bg-blue-100 dark:bg-blue-900/30', textClass: 'text-blue-700 dark:text-blue-300' },
    { label: 'CO', name: 'Comp Off', count: leaveCounts?.compOff || 0, bgClass: 'bg-orange-100 dark:bg-orange-900/30', textClass: 'text-orange-700 dark:text-orange-300' },
    { label: 'PL', name: 'Paid Leave', count: leaveCounts?.paidLeave || 0, bgClass: 'bg-green-100 dark:bg-green-900/30', textClass: 'text-green-700 dark:text-green-300' },
  ];

  const totalLeaves = leaveTypes.reduce((sum, type) => sum + type.count, 0);

  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold text-lg">Leave Summary</h2>
          <p className="text-sm text-muted-foreground">{monthName}</p>
        </div>
      </div>
      
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {leaveTypes.map((type) => (
                <div
                  key={type.label}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                >
                  <div className={`w-10 h-10 rounded-lg ${type.bgClass} flex items-center justify-center`}>
                    <span className={`text-sm font-bold ${type.textClass}`}>{type.label}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{type.count}</p>
                    <p className="text-xs text-muted-foreground">{type.name}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Leave Days</span>
              <span className="text-xl font-bold">{totalLeaves}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
