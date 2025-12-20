import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarOff, Loader2, CalendarClock } from 'lucide-react';
import { format, parseISO, addDays, isToday, isTomorrow } from 'date-fns';
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
  const [todayLeaves, setTodayLeaves] = useState<LeaveEntry[]>([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState<LeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaves();
    
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
          fetchLeaves();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeaves = async () => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const nextWeek = addDays(today, 7);
    const nextWeekStr = format(nextWeek, 'yyyy-MM-dd');

    try {
      // Fetch leaves for today
      const { data: todayData, error: todayError } = await supabase
        .from('leave_requests')
        .select('id, user_id, start_date, end_date, leave_type')
        .eq('status', 'approved')
        .lte('start_date', todayStr)
        .gte('end_date', todayStr);

      if (todayError) throw todayError;

      // Fetch upcoming leaves (next 7 days, excluding today)
      const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('leave_requests')
        .select('id, user_id, start_date, end_date, leave_type')
        .eq('status', 'approved')
        .gte('start_date', tomorrowStr)
        .lte('start_date', nextWeekStr)
        .order('start_date', { ascending: true });

      if (upcomingError) throw upcomingError;

      // Get all user IDs
      const allUserIds = [
        ...new Set([
          ...(todayData || []).map(l => l.user_id),
          ...(upcomingData || []).map(l => l.user_id),
        ]),
      ];

      if (allUserIds.length === 0) {
        setTodayLeaves([]);
        setUpcomingLeaves([]);
        setLoading(false);
        return;
      }

      // Fetch user profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, department')
        .in('user_id', allUserIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, { name: p.full_name, department: p.department }])
      );

      const mapLeaves = (leaves: typeof todayData) =>
        (leaves || []).map(l => ({
          ...l,
          user_name: profileMap.get(l.user_id)?.name || 'Unknown',
          department: profileMap.get(l.user_id)?.department || null,
        }));

      setTodayLeaves(mapLeaves(todayData));
      setUpcomingLeaves(mapLeaves(upcomingData));
    } catch (error) {
      console.error('Error fetching leaves:', error);
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

  const getDateLabel = (startDate: string) => {
    const date = parseISO(startDate);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarOff className="h-5 w-5 text-amber-500" />
            Who's Out
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

  const renderLeaveList = (leaves: LeaveEntry[], emptyMessage: string, showDateLabel = false) => {
    if (leaves.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <CalendarOff className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2 max-h-[240px] overflow-auto">
        {leaves.map(leave => (
          <div
            key={leave.id}
            className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(leave.user_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{leave.user_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {showDateLabel ? getDateLabel(leave.start_date) : leave.department || 'No dept'} 
                {showDateLabel && ` • ${getReturnDate(leave.end_date)}`}
                {!showDateLabel && ` • ${getReturnDate(leave.end_date)}`}
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
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <CalendarOff className="h-5 w-5 text-amber-500" />
            Who's Out
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="today" className="text-xs gap-1">
              <CalendarOff className="h-3 w-3" />
              Today ({todayLeaves.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs gap-1">
              <CalendarClock className="h-3 w-3" />
              Next 7 Days ({upcomingLeaves.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-0">
            {renderLeaveList(todayLeaves, "Everyone's in today!")}
          </TabsContent>
          <TabsContent value="upcoming" className="mt-0">
            {renderLeaveList(upcomingLeaves, 'No upcoming leaves', true)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
