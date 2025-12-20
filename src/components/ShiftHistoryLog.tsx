import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember } from '@/types/roster';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { History, ArrowLeftRight, Plus, Trash2, Edit } from 'lucide-react';

interface ShiftHistoryEntry {
  id: string;
  member_id: string;
  date: string;
  old_shift_type: string | null;
  new_shift_type: string | null;
  action: string;
  changed_by: string | null;
  swap_with_member_id: string | null;
  notes: string | null;
  created_at: string;
}

interface ShiftHistoryLogProps {
  teamMembers: TeamMember[];
  limit?: number;
}

const actionIcons: Record<string, React.ReactNode> = {
  create: <Plus size={14} />,
  update: <Edit size={14} />,
  delete: <Trash2 size={14} />,
  swap: <ArrowLeftRight size={14} />,
};

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  swap: 'bg-purple-100 text-purple-700',
};

export function ShiftHistoryLog({ teamMembers, limit = 50 }: ShiftHistoryLogProps) {
  const [history, setHistory] = useState<ShiftHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [limit]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('shift_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching shift history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMemberName = (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    return member?.name || memberId;
  };

  const getShiftLabel = (shiftType: string | null) => {
    if (!shiftType) return '-';
    const labels: Record<string, string> = {
      morning: 'Morning',
      afternoon: 'Afternoon',
      night: 'Night',
      general: 'General',
      leave: 'Leave',
      'comp-off': 'Week Off',
    };
    return labels[shiftType] || shiftType;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-muted-foreground">Loading history...</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <History className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">No shift changes recorded yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2">
        {history.map((entry) => (
          <div 
            key={entry.id} 
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
          >
            <div className={cn("p-2 rounded-full", actionColors[entry.action] || actionColors.update)}>
              {actionIcons[entry.action] || actionIcons.update}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{getMemberName(entry.member_id)}</span>
                {entry.action === 'swap' && entry.swap_with_member_id && (
                  <>
                    <ArrowLeftRight size={14} className="text-muted-foreground" />
                    <span className="font-medium">{getMemberName(entry.swap_with_member_id)}</span>
                  </>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {entry.action === 'swap' ? (
                  <span>Swapped shifts on {format(new Date(entry.date), 'MMM d, yyyy')}</span>
                ) : entry.action === 'create' ? (
                  <span>
                    Assigned to <Badge variant="outline" className="text-xs">{getShiftLabel(entry.new_shift_type)}</Badge> on {format(new Date(entry.date), 'MMM d, yyyy')}
                  </span>
                ) : entry.action === 'delete' ? (
                  <span>Removed from {format(new Date(entry.date), 'MMM d, yyyy')}</span>
                ) : (
                  <span>
                    Changed from <Badge variant="outline" className="text-xs">{getShiftLabel(entry.old_shift_type)}</Badge> to <Badge variant="outline" className="text-xs">{getShiftLabel(entry.new_shift_type)}</Badge> on {format(new Date(entry.date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
              {entry.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">{entry.notes}</p>
              )}
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(entry.created_at), 'MMM d, HH:mm')}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
