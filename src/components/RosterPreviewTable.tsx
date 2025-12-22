import { useMemo, useState } from 'react';
import { format, isWeekend, isToday, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { TeamMember, ShiftType, Department, TeamGroup, TEAM_GROUPS } from '@/types/roster';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Edit2, Users, Building2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PreviewAssignment {
  member_id: string;
  shift_type: ShiftType;
  date: string;
  department: Department;
}

interface RosterPreviewTableProps {
  assignments: PreviewAssignment[];
  teamMembers: TeamMember[];
  month: Date;
  onEditCell?: (memberId: string, date: string, currentShift: ShiftType | null) => void;
  editable?: boolean;
}

const shiftCellColors: Record<ShiftType | 'off', string> = {
  morning: 'bg-shift-morning text-amber-900',
  afternoon: 'bg-shift-afternoon text-sky-900',
  night: 'bg-shift-night text-violet-900',
  general: 'bg-shift-general text-emerald-900',
  leave: 'bg-red-100 text-red-700',
  'comp-off': 'bg-orange-100 text-orange-700',
  'week-off': 'bg-gray-200 text-gray-700',
  'public-off': 'bg-blue-100 text-blue-700',
  'paid-leave': 'bg-green-100 text-green-700',
  off: 'bg-muted text-muted-foreground',
};

const shiftLetters: Record<ShiftType, string> = {
  morning: 'M',
  afternoon: 'A',
  night: 'N',
  general: 'G',
  leave: 'L',
  'comp-off': 'CO',
  'week-off': 'OFF',
  'public-off': 'PO',
  'paid-leave': 'PL',
};

const TEAM_COLORS: Record<TeamGroup, string> = {
  'Alpha': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'Gamma': 'bg-green-500/20 text-green-700 border-green-500/30',
  'Beta': 'bg-orange-500/20 text-orange-700 border-orange-500/30',
};

export function RosterPreviewTable({ 
  assignments, 
  teamMembers, 
  month,
  onEditCell,
  editable = false 
}: RosterPreviewTableProps) {
  const [viewMode, setViewMode] = useState<'team' | 'department'>('team');
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group members by team
  const membersByTeam = useMemo(() => {
    const grouped: Record<string, TeamMember[]> = {};
    TEAM_GROUPS.forEach(team => {
      grouped[team] = teamMembers.filter(m => (m.team || 'Alpha') === team);
    });
    // Add "No Team" for members without team assignment
    const noTeam = teamMembers.filter(m => !m.team);
    if (noTeam.length > 0 && !grouped['Alpha']?.some(m => noTeam.includes(m))) {
      // Members without team are already in Alpha
    }
    return grouped;
  }, [teamMembers]);

  // Group members by department
  const membersByDepartment = useMemo(() => {
    const grouped: Record<string, TeamMember[]> = {};
    teamMembers.forEach(member => {
      if (!grouped[member.department]) {
        grouped[member.department] = [];
      }
      grouped[member.department].push(member);
    });
    return grouped;
  }, [teamMembers]);

  const getAssignment = (memberId: string, date: string): ShiftType | null => {
    const assignment = assignments.find(a => a.member_id === memberId && a.date === date);
    return assignment?.shift_type || null;
  };

  const getMemberStats = (memberId: string) => {
    const memberAssignments = assignments.filter(a => a.member_id === memberId);
    const weekOffs = memberAssignments.filter(a => a.shift_type === 'week-off').length;
    return {
      morning: memberAssignments.filter(a => a.shift_type === 'morning').length,
      afternoon: memberAssignments.filter(a => a.shift_type === 'afternoon').length,
      night: memberAssignments.filter(a => a.shift_type === 'night').length,
      general: memberAssignments.filter(a => a.shift_type === 'general').length,
      leave: memberAssignments.filter(a => a.shift_type === 'leave').length,
      compOff: memberAssignments.filter(a => a.shift_type === 'comp-off').length,
      weekOff: weekOffs,
      off: monthDays.length - memberAssignments.length,
      total: memberAssignments.length,
    };
  };

  // Calculate team shift summary for today
  const getTeamShiftSummary = (team: TeamGroup) => {
    const members = membersByTeam[team] || [];
    const memberIds = new Set(members.map(m => m.id));
    
    const summary = {
      morning: 0,
      afternoon: 0,
      night: 0,
      general: 0,
      off: 0,
      total: members.length,
    };

    // Get all assignments for all days and aggregate
    assignments.forEach(a => {
      if (memberIds.has(a.member_id)) {
        if (a.shift_type === 'morning') summary.morning++;
        else if (a.shift_type === 'afternoon') summary.afternoon++;
        else if (a.shift_type === 'night') summary.night++;
        else if (a.shift_type === 'general') summary.general++;
        else if (a.shift_type === 'week-off' || a.shift_type === 'public-off' || a.shift_type === 'comp-off') summary.off++;
      }
    });

    return summary;
  };

  // Helper to render member row
  const renderMemberRow = (member: TeamMember) => {
    const stats = getMemberStats(member.id);
    return (
      <tr key={member.id} className="border-b border-border/20 hover:bg-muted/10">
        <td className="sticky left-0 z-10 bg-card p-1.5 font-medium truncate">
          <div className="flex items-center gap-1">
            <span>{member.name}</span>
            {viewMode === 'department' && member.team && (
              <span className={cn(
                "px-1 py-0.5 rounded text-[8px] font-medium border",
                TEAM_COLORS[member.team as TeamGroup] || TEAM_COLORS['Alpha']
              )}>
                {member.team?.charAt(0)}
              </span>
            )}
          </div>
        </td>
        <td className="sticky left-[140px] z-10 bg-card p-1.5">
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium",
            member.role === 'TL' && "bg-primary/10 text-primary",
            member.role === 'L2' && "bg-sky-100 text-sky-700",
            member.role === 'L1' && "bg-emerald-100 text-emerald-700",
            member.role === 'HR' && "bg-pink-100 text-pink-700"
          )}>
            {member.role}
          </span>
        </td>
        {monthDays.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const shift = getAssignment(member.id, dateStr);
          const weekend = isWeekend(day);
          
          return (
            <td 
              key={dateStr}
              className={cn(
                "p-0.5 text-center",
                weekend && !shift && "bg-muted/30",
                editable && "cursor-pointer hover:bg-primary/10"
              )}
              onClick={() => editable && onEditCell?.(member.id, dateStr, shift)}
            >
              {shift ? (
                <span className={cn(
                  "inline-flex items-center justify-center w-5 h-4 rounded text-[9px] font-bold",
                  shiftCellColors[shift]
                )}>
                  {shiftLetters[shift]}
                </span>
              ) : (
                <span className="inline-flex items-center justify-center w-5 h-4 text-[9px] text-muted-foreground">
                  -
                </span>
              )}
            </td>
          );
        })}
        <td className="p-1 text-center font-medium bg-shift-morning/20">{stats.morning || '-'}</td>
        <td className="p-1 text-center font-medium bg-shift-afternoon/20">{stats.afternoon || '-'}</td>
        <td className="p-1 text-center font-medium bg-shift-night/20">{stats.night || '-'}</td>
        <td className="p-1 text-center font-medium bg-muted/30">{stats.weekOff + stats.compOff}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-3">
      {/* Team Shift Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {TEAM_GROUPS.map(team => {
          const summary = getTeamShiftSummary(team);
          const members = membersByTeam[team] || [];
          return (
            <div 
              key={team}
              className={cn(
                "rounded-lg border p-3",
                team === 'Alpha' && "bg-blue-50 dark:bg-blue-950/30 border-blue-300",
                team === 'Gamma' && "bg-green-50 dark:bg-green-950/30 border-green-300",
                team === 'Beta' && "bg-orange-50 dark:bg-orange-950/30 border-orange-300"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "px-2 py-0.5 rounded border font-bold text-sm",
                  TEAM_COLORS[team]
                )}>
                  Team {team}
                </span>
                <span className="text-xs text-muted-foreground">{members.length} members</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded bg-shift-morning p-1.5">
                  <div className="font-bold text-amber-900">{summary.morning}</div>
                  <div className="text-amber-700 text-[10px]">Morning</div>
                </div>
                <div className="rounded bg-shift-afternoon p-1.5">
                  <div className="font-bold text-sky-900">{summary.afternoon}</div>
                  <div className="text-sky-700 text-[10px]">Afternoon</div>
                </div>
                <div className="rounded bg-shift-night p-1.5">
                  <div className="font-bold text-violet-900">{summary.night}</div>
                  <div className="text-violet-700 text-[10px]">Night</div>
                </div>
                <div className="rounded bg-gray-200 p-1.5">
                  <div className="font-bold text-gray-700">{summary.off}</div>
                  <div className="text-gray-600 text-[10px]">Offs</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Mode Toggle */}
      <div className="flex justify-end">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'team' | 'department')}>
          <TabsList className="h-8">
            <TabsTrigger value="team" className="text-xs gap-1 h-7">
              <Users size={12} />
              Team View
            </TabsTrigger>
            <TabsTrigger value="department" className="text-xs gap-1 h-7">
              <Building2 size={12} />
              Department View
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="sticky left-0 z-20 bg-muted/50 p-2 text-left font-medium min-w-[140px]">Name</th>
              <th className="sticky left-[140px] z-20 bg-muted/50 p-2 text-left font-medium min-w-[60px]">Role</th>
              {monthDays.map(day => (
                <th 
                  key={format(day, 'yyyy-MM-dd')} 
                  className={cn(
                    "p-1 text-center font-normal min-w-[28px]",
                    isWeekend(day) && "bg-muted/50",
                    isToday(day) && "bg-primary/10"
                  )}
                >
                  <div className="text-muted-foreground text-[10px]">{format(day, 'EEE').charAt(0)}</div>
                  <div className="font-semibold">{format(day, 'd')}</div>
                </th>
              ))}
              <th className="p-1 text-center font-medium bg-shift-morning min-w-[24px]">M</th>
              <th className="p-1 text-center font-medium bg-shift-afternoon min-w-[24px]">A</th>
              <th className="p-1 text-center font-medium bg-shift-night min-w-[24px]">N</th>
              <th className="p-1 text-center font-medium bg-muted min-w-[28px]">Off</th>
            </tr>
          </thead>
          <tbody>
            {viewMode === 'team' ? (
              // Team-based view
              <>
                {TEAM_GROUPS.map(team => {
                  const members = membersByTeam[team] || [];
                  if (members.length === 0) return null;
                  
                  return (
                    <>
                      <tr key={`team-${team}`} className={cn(
                        "border-t-2",
                        team === 'Alpha' && "bg-blue-50 dark:bg-blue-950/30 border-blue-300",
                        team === 'Gamma' && "bg-green-50 dark:bg-green-950/30 border-green-300",
                        team === 'Beta' && "bg-orange-50 dark:bg-orange-950/30 border-orange-300"
                      )}>
                        <td colSpan={monthDays.length + 6} className="p-2 font-semibold text-xs">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded border font-bold",
                              TEAM_COLORS[team]
                            )}>
                              Team {team}
                            </span>
                            <span className="text-muted-foreground">({members.length} members)</span>
                          </div>
                        </td>
                      </tr>
                      {members.map(member => renderMemberRow(member))}
                    </>
                  );
                })}
              </>
            ) : (
              // Department-based view
              <>
                {Object.entries(membersByDepartment).map(([department, members]) => (
                  <>
                    <tr key={`dept-${department}`} className="bg-muted/20">
                      <td colSpan={monthDays.length + 6} className="p-2 font-semibold text-xs">
                        {department} ({members.length})
                      </td>
                    </tr>
                    {members.map(member => renderMemberRow(member))}
                  </>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px]">
        {Object.entries(shiftLetters).map(([shift, letter]) => (
          <div key={shift} className="flex items-center gap-1">
            <span className={cn("w-4 h-3 rounded flex items-center justify-center font-bold", shiftCellColors[shift as ShiftType])}>
              {letter}
            </span>
            <span className="text-muted-foreground capitalize">{shift.replace('-', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
