import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths } from 'date-fns';
import { Eye, RefreshCw, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { TeamMember, TeamGroup } from '@/types/roster';
import { cn } from '@/lib/utils';

const TEAM_COLORS: Record<TeamGroup, string> = {
  'Alpha': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'Gamma': 'bg-green-500/20 text-green-700 border-green-500/30',
  'Beta': 'bg-orange-500/20 text-orange-700 border-orange-500/30',
};

interface RotationPreviewProps {
  teamMembers: TeamMember[];
}

const SHIFT_COLORS: Record<string, string> = {
  'morning': 'bg-blue-500 text-white',
  'afternoon': 'bg-amber-500 text-white',
  'night': 'bg-purple-600 text-white',
  'general': 'bg-emerald-500 text-white',
  'week-off': 'bg-gray-300 text-gray-700',
  'public-off': 'bg-blue-200 text-blue-800',
  'paid-leave': 'bg-green-200 text-green-800',
  'leave': 'bg-red-200 text-red-800',
  'comp-off': 'bg-orange-200 text-orange-800',
};

const SHIFT_LABELS: Record<string, string> = {
  'morning': 'M',
  'afternoon': 'A',
  'night': 'N',
  'general': 'G',
  'week-off': 'OFF',
  'public-off': 'PH',
  'paid-leave': 'PL',
  'leave': 'L',
  'comp-off': 'CO',
};

interface ShiftAssignment {
  id: string;
  member_id: string;
  date: string;
  shift_type: string;
  department: string;
}

export function RotationPreview({ teamMembers }: RotationPreviewProps) {
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewMonth, setPreviewMonth] = useState<Date>(new Date());

  useEffect(() => {
    fetchAssignments();
  }, [previewMonth]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(previewMonth);
      const monthEnd = endOfMonth(previewMonth);

      const { data, error } = await supabase
        .from('shift_assignments')
        .select('*')
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'))
        .order('date');

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to load shift assignments');
    } finally {
      setLoading(false);
    }
  };

  // Generate preview data from imported shifts
  const previewData = useMemo(() => {
    if (assignments.length === 0) return [];

    const monthStart = startOfMonth(previewMonth);
    const monthEnd = endOfMonth(previewMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Filter to rotating department members (Infra)
    const rotatingMembers = teamMembers.filter(m => 
      m.department === 'Infra' && m.role !== 'TL'
    );

    return rotatingMembers.map((member) => {
      const memberTeam = (member.team as TeamGroup) || 'Alpha';

      const shifts = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const assignment = assignments.find(a => a.member_id === member.id && a.date === dateStr);
        
        return {
          date: dateStr,
          dayNum: format(day, 'd'),
          dayName: format(day, 'EEE'),
          shiftType: assignment?.shift_type || null,
        };
      });

      return {
        member,
        team: memberTeam,
        shifts,
      };
    });
  }, [previewMonth, assignments, teamMembers]);

  // Calculate shift summary for the month
  const shiftSummary = useMemo(() => {
    const summary = {
      morning: 0,
      afternoon: 0,
      night: 0,
      general: 0,
      leave: 0,
      weekOff: 0,
    };

    assignments.forEach(a => {
      if (a.shift_type === 'morning') summary.morning++;
      else if (a.shift_type === 'afternoon') summary.afternoon++;
      else if (a.shift_type === 'night') summary.night++;
      else if (a.shift_type === 'general') summary.general++;
      else if (a.shift_type === 'leave') summary.leave++;
      else if (a.shift_type === 'week-off') summary.weekOff++;
    });

    return summary;
  }, [assignments]);

  const goToPreviousMonth = () => setPreviewMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setPreviewMonth(prev => addMonths(prev, 1));

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading shift data...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye size={20} />
              Imported Roster Preview
            </CardTitle>
            <CardDescription>
              View imported shifts for the selected month (from CSV/Setup)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft size={18} />
            </Button>
            <div className="min-w-[140px] text-center font-medium">
              {format(previewMonth, 'MMMM yyyy')}
            </div>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight size={18} />
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAssignments} className="gap-2 ml-2">
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Shift Summary Cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{shiftSummary.morning}</p>
            <p className="text-xs text-muted-foreground">Morning</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{shiftSummary.afternoon}</p>
            <p className="text-xs text-muted-foreground">Afternoon</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{shiftSummary.night}</p>
            <p className="text-xs text-muted-foreground">Night</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{shiftSummary.general}</p>
            <p className="text-xs text-muted-foreground">General</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{shiftSummary.leave}</p>
            <p className="text-xs text-muted-foreground">Leave</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-950/30 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{shiftSummary.weekOff}</p>
            <p className="text-xs text-muted-foreground">Week Off</p>
          </div>
        </div>

        {/* Preview Table */}
        {previewData.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="sticky left-0 z-10 bg-muted/50 p-2 text-left font-medium min-w-[120px]">
                      Member
                    </th>
                    <th className="p-2 text-left font-medium min-w-[60px]">
                      Team
                    </th>
                    {previewData[0]?.shifts.map(s => (
                      <th key={s.date} className="p-1 text-center min-w-[28px]">
                        <div className="text-muted-foreground text-[10px]">{s.dayName?.charAt(0) || ''}</div>
                        <div className="font-semibold">{s.dayNum}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map(({ member, team, shifts }) => (
                    <tr key={member.id} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="sticky left-0 z-10 bg-card p-2 font-medium truncate">
                        <div>{member.name}</div>
                        <div className="text-[10px] text-muted-foreground">{member.department}</div>
                      </td>
                      <td className="p-1">
                        <Badge variant="outline" className={cn("text-[10px]", TEAM_COLORS[team])}>
                          {team}
                        </Badge>
                      </td>
                      {shifts.map(s => (
                        <td key={s.date} className="p-0.5 text-center">
                          {s.shiftType ? (
                            <span className={cn(
                              "inline-flex items-center justify-center w-5 h-4 rounded text-[9px] font-bold",
                              SHIFT_COLORS[s.shiftType] || 'bg-muted text-muted-foreground'
                            )}>
                              {SHIFT_LABELS[s.shiftType] || '-'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-4 text-[9px] text-muted-foreground">
                              -
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p>No shift data for this month</p>
            <p className="text-sm">Import a roster CSV or use Setup to create shifts</p>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] pt-4 border-t">
          {Object.entries(SHIFT_LABELS).map(([shift, label]) => (
            <div key={shift} className="flex items-center gap-1">
              <span className={cn("w-4 h-3 rounded flex items-center justify-center font-bold", SHIFT_COLORS[shift])}>
                {label}
              </span>
              <span className="text-muted-foreground capitalize">{shift.replace('-', ' ')}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
