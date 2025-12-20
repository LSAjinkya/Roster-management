import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CalendarOff, Loader2 } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeaveEntry {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  user_name: string;
  department: string | null;
}

const LEAVE_TYPE_COLORS: Record<string, string> = {
  casual: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  sick: 'bg-orange-500/20 text-orange-700 border-orange-500/30',
  'comp-off': 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  other: 'bg-gray-500/20 text-gray-700 border-gray-500/30',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  casual: 'Leave',
  sick: 'Sick',
  'comp-off': 'Comp-Off',
  other: 'Other',
};

export function WhosOutToday() {
  const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayLeaves();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('whos-out-today')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_requests',
        },
        () => {
          fetchTodayLeaves();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTodayLeaves = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    try {
      const { data: leaveData, error } = await supabase
        .from('leave_requests')
        .select('id, user_id, start_date, end_date, leave_type')
        .eq('status', 'approved')
        .lte('start_date', today)
        .gte('end_date', today);

      if (error) throw error;

      if (!leaveData || leaveData.length === 0) {
        setLeaves([]);
        setLoading(false);
        return;
      }

      // Fetch user names and departments
      const userIds = [...new Set(leaveData.map(l => l.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, department')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, { name: p.full_name, department: p.department }])
      );

      const leavesWithNames = leaveData.map(l => ({
        ...l,
        user_name: profileMap.get(l.user_id)?.name || 'Unknown',
        department: profileMap.get(l.user_id)?.department || null,
      }));

      setLeaves(leavesWithNames);
    } catch (error) {
      console.error('Error fetching today leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getReturnDate = (endDate: string) => {
    const end = parseISO(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (end.getTime() === today.getTime()) {
      return 'Returns tomorrow';
    }
    return `Until ${format(end, 'MMM d')}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarOff className="h-5 w-5 text-amber-500" />
            Who's Out Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <CalendarOff className="h-5 w-5 text-amber-500" />
            Who's Out Today
          </span>
          <Badge variant="secondary" className="text-xs">
            {leaves.length} {leaves.length === 1 ? 'person' : 'people'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leaves.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CalendarOff className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Everyone's in today!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-auto">
            {leaves.map(leave => (
              <div
                key={leave.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {getInitials(leave.user_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{leave.user_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {leave.department || 'No department'} • {getReturnDate(leave.end_date)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-xs shrink-0', LEAVE_TYPE_COLORS[leave.leave_type])}
                >
                  {LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
