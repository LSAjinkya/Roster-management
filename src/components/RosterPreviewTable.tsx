import { useMemo } from 'react';
import { format, isWeekend, isToday, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { TeamMember, ShiftType, Department } from '@/types/roster';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Edit2 } from 'lucide-react';

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
  off: 'bg-muted text-muted-foreground',
};

const shiftLetters: Record<ShiftType, string> = {
  morning: 'M',
  afternoon: 'A',
  night: 'N',
  general: 'G',
  leave: 'L',
  'comp-off': 'CO',
};

export function RosterPreviewTable({ 
  assignments, 
  teamMembers, 
  month,
  onEditCell,
  editable = false 
}: RosterPreviewTableProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

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
    return {
      morning: memberAssignments.filter(a => a.shift_type === 'morning').length,
      afternoon: memberAssignments.filter(a => a.shift_type === 'afternoon').length,
      night: memberAssignments.filter(a => a.shift_type === 'night').length,
      general: memberAssignments.filter(a => a.shift_type === 'general').length,
      leave: memberAssignments.filter(a => a.shift_type === 'leave').length,
      compOff: memberAssignments.filter(a => a.shift_type === 'comp-off').length,
      off: monthDays.length - memberAssignments.length,
      total: memberAssignments.length,
    };
  };

  return (
    <div className="space-y-2">
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
            {Object.entries(membersByDepartment).map(([department, members]) => (
              <>
                <tr key={`dept-${department}`} className="bg-muted/20">
                  <td colSpan={monthDays.length + 6} className="p-2 font-semibold text-xs">
                    {department} ({members.length})
                  </td>
                </tr>
                {members.map(member => {
                  const stats = getMemberStats(member.id);
                  return (
                    <tr key={member.id} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="sticky left-0 z-10 bg-card p-1.5 font-medium truncate">
                        {member.name}
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
                      <td className="p-1 text-center font-medium bg-muted/30">{stats.off + stats.compOff}</td>
                    </tr>
                  );
                })}
              </>
            ))}
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
