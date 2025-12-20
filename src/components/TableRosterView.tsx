import { useState, useMemo } from 'react';
import { ShiftAssignment, TeamMember, ShiftType, Department, DEPARTMENTS } from '@/types/roster';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  subMonths,
  isSameMonth,
  isToday,
  getDay,
  isWeekend
} from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExportDropdown } from './ExportDropdown';

interface TableRosterViewProps {
  assignments: ShiftAssignment[];
  teamMembers: TeamMember[];
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

export function TableRosterView({ assignments, teamMembers }: TableRosterViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(startOfMonth(new Date()));

  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  // Filter members
  const filteredMembers = useMemo(() => {
    if (departmentFilter === 'all') return teamMembers;
    return teamMembers.filter(m => m.department === departmentFilter);
  }, [teamMembers, departmentFilter]);

  // Group members by department for display
  const membersByDepartment = useMemo(() => {
    const grouped: { [key: string]: TeamMember[] } = {};
    filteredMembers.forEach(member => {
      if (!grouped[member.department]) {
        grouped[member.department] = [];
      }
      grouped[member.department].push(member);
    });
    return grouped;
  }, [filteredMembers]);

  const getMemberShift = (memberId: string, date: Date): ShiftType | 'off' | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const assignment = assignments.find(a => a.memberId === memberId && a.date === dateStr);
    return assignment?.shiftType || null;
  };

  const getMemberStats = (memberId: string) => {
    const memberAssignments = assignments.filter(
      a => a.memberId === memberId && 
      monthDays.some(day => format(day, 'yyyy-MM-dd') === a.date)
    );
    
    return {
      morning: memberAssignments.filter(a => a.shiftType === 'morning').length,
      afternoon: memberAssignments.filter(a => a.shiftType === 'afternoon').length,
      night: memberAssignments.filter(a => a.shiftType === 'night').length,
      general: memberAssignments.filter(a => a.shiftType === 'general').length,
      off: monthDays.length - memberAssignments.length,
      total: memberAssignments.length,
    };
  };

  // Find reporting TL for a member
  const getReportingTL = (member: TeamMember): TeamMember | undefined => {
    if (member.reportingTLId) {
      return teamMembers.find(m => m.id === member.reportingTLId);
    }
    return undefined;
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft size={18} />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight size={18} />
            </Button>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <p className="text-sm text-muted-foreground">{filteredMembers.length} members</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v as Department | 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {DEPARTMENTS.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isCurrentMonth && (
            <Button variant="outline" onClick={goToCurrentMonth} className="gap-2">
              <Calendar size={16} />
              Today
            </Button>
          )}

          <ExportDropdown
            assignments={assignments}
            teamMembers={filteredMembers}
            startDate={monthStart}
            endDate={monthEnd}
            viewType="monthly"
          />
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              {/* Day names row */}
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="sticky left-0 z-20 bg-muted/50 p-2 text-left font-medium min-w-[120px]">Manager</th>
                <th className="sticky left-[120px] z-20 bg-muted/50 p-2 text-left font-medium min-w-[140px]">Name</th>
                <th className="sticky left-[260px] z-20 bg-muted/50 p-2 text-left font-medium min-w-[80px]">Level</th>
                {monthDays.map(day => (
                  <th 
                    key={format(day, 'yyyy-MM-dd')} 
                    className={cn(
                      "p-1 text-center font-normal min-w-[32px]",
                      isWeekend(day) && "bg-muted/50",
                      isToday(day) && "bg-primary/10"
                    )}
                  >
                    <div className="text-muted-foreground">{format(day, 'EEE').charAt(0)}</div>
                  </th>
                ))}
                <th className="p-1 text-center font-medium bg-shift-morning min-w-[28px]">M</th>
                <th className="p-1 text-center font-medium bg-shift-afternoon min-w-[28px]">A</th>
                <th className="p-1 text-center font-medium bg-shift-night min-w-[28px]">N</th>
                <th className="p-1 text-center font-medium bg-shift-general min-w-[28px]">G</th>
                <th className="p-1 text-center font-medium bg-muted min-w-[32px]">Off</th>
                <th className="p-1 text-center font-medium min-w-[40px]">Total</th>
              </tr>
              {/* Day numbers row */}
              <tr className="border-b border-border bg-muted/20">
                <th className="sticky left-0 z-20 bg-muted/30 p-2"></th>
                <th className="sticky left-[120px] z-20 bg-muted/30 p-2"></th>
                <th className="sticky left-[260px] z-20 bg-muted/30 p-2"></th>
                {monthDays.map(day => (
                  <th 
                    key={format(day, 'yyyy-MM-dd')} 
                    className={cn(
                      "p-1 text-center font-semibold",
                      isWeekend(day) && "bg-muted/50 text-muted-foreground",
                      isToday(day) && "bg-primary text-primary-foreground rounded"
                    )}
                  >
                    {format(day, 'd')}
                  </th>
                ))}
                <th colSpan={6}></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(membersByDepartment).map(([department, members]) => (
                members.map((member, memberIndex) => {
                  const stats = getMemberStats(member.id);
                  const reportingTL = getReportingTL(member);
                  
                  return (
                    <tr 
                      key={member.id} 
                      className={cn(
                        "border-b border-border/30 hover:bg-muted/20 transition-colors",
                        memberIndex === 0 && "border-t border-border/50"
                      )}
                    >
                      {/* Manager/TL column */}
                      <td className="sticky left-0 z-10 bg-card p-2 font-medium text-muted-foreground truncate">
                        {member.role === 'TL' ? member.name : (reportingTL?.name || '-')}
                      </td>
                      {/* Member name */}
                      <td className="sticky left-[120px] z-10 bg-card p-2 font-medium">
                        <div className="truncate">{member.name}</div>
                        <div className="text-muted-foreground text-[10px] truncate">{member.department}</div>
                      </td>
                      {/* Level */}
                      <td className="sticky left-[260px] z-10 bg-card p-2">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium",
                          member.role === 'TL' && "bg-primary/10 text-primary",
                          member.role === 'L2' && "bg-shift-afternoon-light text-sky-700",
                          member.role === 'L1' && "bg-shift-general-light text-emerald-700"
                        )}>
                          {member.role}
                        </span>
                      </td>
                      {/* Day cells */}
                      {monthDays.map(day => {
                        const shift = getMemberShift(member.id, day);
                        const weekend = isWeekend(day);
                        const today = isToday(day);
                        
                        return (
                          <td 
                            key={format(day, 'yyyy-MM-dd')}
                            className={cn(
                              "p-0.5 text-center",
                              weekend && !shift && "bg-muted/30",
                              today && "ring-1 ring-primary ring-inset"
                            )}
                          >
                            {shift ? (
                              <span className={cn(
                                "inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-bold",
                                shiftCellColors[shift]
                              )}>
                                {shiftLetters[shift]}
                              </span>
                            ) : (
                              <span className={cn(
                                "inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-medium",
                                shiftCellColors.off
                              )}>
                                -
                              </span>
                            )}
                          </td>
                        );
                      })}
                      {/* Summary columns */}
                      <td className="p-1 text-center font-medium bg-shift-morning/30">{stats.morning || '-'}</td>
                      <td className="p-1 text-center font-medium bg-shift-afternoon/30">{stats.afternoon || '-'}</td>
                      <td className="p-1 text-center font-medium bg-shift-night/30">{stats.night || '-'}</td>
                      <td className="p-1 text-center font-medium bg-shift-general/30">{stats.general || '-'}</td>
                      <td className="p-1 text-center font-medium bg-muted/50">{stats.off}</td>
                      <td className="p-1 text-center font-bold">{stats.total}</td>
                    </tr>
                  );
                })
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors.morning)}>M</span>
          <span className="text-muted-foreground">Morning (07:00-16:00)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors.afternoon)}>A</span>
          <span className="text-muted-foreground">Afternoon (13:00-22:00)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors.night)}>N</span>
          <span className="text-muted-foreground">Night (21:00-07:00)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors.general)}>G</span>
          <span className="text-muted-foreground">General (10:00-19:00)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center", shiftCellColors.off)}>-</span>
          <span className="text-muted-foreground">Weekly Off</span>
        </div>
      </div>
    </div>
  );
}
