import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShiftBadge } from '@/components/ShiftBadge';
import { CalendarDays, Loader2 } from 'lucide-react';
import { format, addDays, isToday, isTomorrow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ShiftType } from '@/types/roster';

interface ShiftAssignment {
  id: string;
  date: string;
  shift_type: ShiftType;
}

export function MyUpcomingShifts() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      fetchTeamMemberId();
    }
  }, [user?.email]);

  useEffect(() => {
    if (teamMemberId) {
      fetchUpcomingShifts();
    }
  }, [teamMemberId]);

  const fetchTeamMemberId = async () => {
    if (!user?.email) return;

    const { data } = await supabase
      .from('team_members')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    if (data) {
      setTeamMemberId(data.id);
    } else {
      setLoading(false);
    }
  };

  const fetchUpcomingShifts = async () => {
    if (!teamMemberId) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('id, date, shift_type')
        .eq('member_id', teamMemberId)
        .gte('date', today)
        .lte('date', nextWeek)
        .order('date', { ascending: true });

      if (error) throw error;

      setShifts((data || []) as ShiftAssignment[]);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  const getDayOfWeek = (dateStr: string) => {
    return format(parseISO(dateStr), 'EEEE');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5 text-primary" />
            My Upcoming Shifts
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

  if (!teamMemberId) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5 text-primary" />
            My Upcoming Shifts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No team member profile linked</p>
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
            <CalendarDays className="h-5 w-5 text-primary" />
            My Upcoming Shifts
          </span>
          <Badge variant="secondary" className="text-xs">
            Next 7 days
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {shifts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No shifts scheduled</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-auto">
            {shifts.map(shift => {
              const isCurrentDay = isToday(parseISO(shift.date));
              
              return (
                <div
                  key={shift.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg transition-colors',
                    isCurrentDay 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-muted/50 hover:bg-muted'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[50px]">
                      <p className={cn(
                        'text-lg font-bold',
                        isCurrentDay && 'text-primary'
                      )}>
                        {format(parseISO(shift.date), 'd')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(shift.date), 'MMM')}
                      </p>
                    </div>
                    <div>
                      <p className={cn(
                        'font-medium text-sm',
                        isCurrentDay && 'text-primary'
                      )}>
                        {getDateLabel(shift.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getDayOfWeek(shift.date)}
                      </p>
                    </div>
                  </div>
                  <ShiftBadge type={shift.shift_type} size="sm" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
