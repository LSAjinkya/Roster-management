import { useState, useMemo } from 'react';
import { ShiftAssignment, TeamMember, ShiftType, Department, DEPARTMENTS, TeamGroup, TEAM_GROUPS } from '@/types/roster';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Edit2, ArrowLeftRight } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  subMonths,
  isSameMonth,
  isToday,
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
import { ShiftEditDialog } from './ShiftEditDialog';
import { ShiftSwapDialog } from './ShiftSwapDialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface TableRosterViewProps {
  assignments: ShiftAssignment[];
  teamMembers: TeamMember[];
  onShiftChange?: (memberId: string, date: string, shiftType: ShiftType | 'off') => void;
  onRefresh?: () => void;
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

export function TableRosterView({ assignments, teamMembers, onShiftChange, onRefresh }: TableRosterViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState<TeamGroup | 'all'>('all');
  const [tlFilter, setTlFilter] = useState<string>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftType | null>(null);
  
  const { canEditShifts, isTL, user } = useAuth();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(startOfMonth(new Date()));

  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  // Get list of TLs and Managers for filter
  const tlMembers = useMemo(() => {
    return teamMembers.filter(m => m.role === 'TL' || m.role === 'Manager');
  }, [teamMembers]);

  // Get department managers lookup
  const departmentManagers = useMemo(() => {
    const managers: Record<string, TeamMember> = {};
    teamMembers.forEach(m => {
      if ((m.role === 'Manager' || m.role === 'TL') && !managers[m.department]) {
        managers[m.department] = m;
      }
    });
    return managers;
  }, [teamMembers]);

  // Get selected TL for highlighted row
  const selectedTL = useMemo(() => {
    if (tlFilter !== 'all') {
      return teamMembers.find(m => m.id === tlFilter);
    }
    return null;
  }, [teamMembers, tlFilter]);

  // Filter members by department, team and TL (show only members reporting to selected TL)
  const filteredMembers = useMemo(() => {
    let members = teamMembers;
    if (departmentFilter !== 'all') {
      members = members.filter(m => m.department === departmentFilter);
    }
    if (teamFilter !== 'all') {
      members = members.filter(m => m.team === teamFilter);
    }
    if (tlFilter !== 'all') {
      members = members.filter(m => m.reportingTLId === tlFilter);
    }
    return members;
  }, [teamMembers, departmentFilter, teamFilter, tlFilter]);

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

  const getMemberShift = (memberId: string, date: Date): ShiftType | null => {
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
      leave: memberAssignments.filter(a => a.shiftType === 'leave').length,
      compOff: memberAssignments.filter(a => a.shiftType === 'comp-off').length,
      off: monthDays.length - memberAssignments.length,
      total: memberAssignments.length,
    };
  };

  // Find department manager for a member
  const getDepartmentManager = (member: TeamMember): TeamMember | undefined => {
    return departmentManagers[member.department];
  };

  const handleCellClick = (member: TeamMember, day: Date, isRightClick = false) => {
    if (!canEditShifts) {
      toast.error('You do not have permission to edit shifts');
      return;
    }
    
    const shift = getMemberShift(member.id, day);
    setEditingMember(member);
    setEditingDate(day);
    setEditingShift(shift);
    
    if (isRightClick && shift) {
      setSwapDialogOpen(true);
    } else {
      setEditDialogOpen(true);
    }
  };

  const handleShiftSave = (memberId: string, date: string, shiftType: ShiftType | 'off') => {
    if (onShiftChange) {
      onShiftChange(memberId, date, shiftType);
    }
    onRefresh?.();
  };

  const handleSwapComplete = () => {
    onRefresh?.();
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
          {canEditShifts && (
            <Badge variant="outline" className="gap-1">
              <Edit2 size={12} />
              Edit Mode
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v as Department | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {DEPARTMENTS.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v as TeamGroup | 'all')}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {TEAM_GROUPS.map(team => (
                <SelectItem key={team} value={team}>
                  <Badge variant="outline" className={
                    team === 'Alpha' ? 'bg-blue-500/20 text-blue-700 border-blue-500/30' :
                    team === 'Gamma' ? 'bg-green-500/20 text-green-700 border-green-500/30' :
                    'bg-orange-500/20 text-orange-700 border-orange-500/30'
                  }>
                    {team}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tlFilter} onValueChange={setTlFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All TLs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All TLs</SelectItem>
              {tlMembers.map(tl => (
                <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
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
                <th className="p-1 text-center font-medium bg-red-100 min-w-[28px]">L</th>
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
                <th colSpan={7}></th>
              </tr>
            </thead>
            <tbody>
              {/* Highlighted TL row when filtering by TL */}
              {selectedTL && (
                (() => {
                  const stats = getMemberStats(selectedTL.id);
                  return (
                    <tr className="border-b-2 border-primary/50 bg-primary/5">
                      {/* Manager/TL column */}
                      <td className="sticky left-0 z-10 bg-primary/10 p-2 font-semibold text-primary truncate">
                        Team Lead
                      </td>
                      {/* Member name */}
                      <td className="sticky left-[120px] z-10 bg-primary/10 p-2 font-semibold">
                        <div className="truncate text-primary">{selectedTL.name}</div>
                        <div className="text-primary/70 text-[10px] truncate">{selectedTL.department}</div>
                      </td>
                      {/* Level */}
                      <td className="sticky left-[260px] z-10 bg-primary/10 p-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary text-primary-foreground">
                          {selectedTL.role}
                        </span>
                      </td>
                      {/* Day cells */}
                      {monthDays.map(day => {
                        const shift = getMemberShift(selectedTL.id, day);
                        const weekend = isWeekend(day);
                        const today = isToday(day);
                        
                        return (
                          <td 
                            key={format(day, 'yyyy-MM-dd')}
                            className={cn(
                              "p-0.5 text-center bg-primary/5",
                              weekend && !shift && "bg-primary/10",
                              today && "ring-1 ring-primary ring-inset",
                              canEditShifts && "cursor-pointer hover:bg-primary/20"
                            )}
                            onClick={() => canEditShifts && handleCellClick(selectedTL, day, false)}
                            onContextMenu={(e) => {
                              if (canEditShifts && shift) {
                                e.preventDefault();
                                handleCellClick(selectedTL, day, true);
                              }
                            }}
                            title={canEditShifts ? "Click to edit, Right-click to swap" : undefined}
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
                      <td className="p-1 text-center font-medium bg-red-100/30">{stats.leave || '-'}</td>
                      <td className="p-1 text-center font-medium bg-muted/50">{stats.off}</td>
                      <td className="p-1 text-center font-bold">{stats.total}</td>
                    </tr>
                  );
                })()
              )}
              {Object.entries(membersByDepartment).map(([department, members]) => (
                members.map((member, memberIndex) => {
                  const stats = getMemberStats(member.id);
                  const deptManager = getDepartmentManager(member);
                  
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
                        {member.role === 'TL' || member.role === 'Manager' || member.role === 'HR' ? member.name : (deptManager?.name || '-')}
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
                          member.role === 'L1' && "bg-shift-general-light text-emerald-700",
                          member.role === 'HR' && "bg-pink-100 text-pink-700"
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
                              today && "ring-1 ring-primary ring-inset",
                              canEditShifts && "cursor-pointer hover:bg-primary/10"
                            )}
                            onClick={() => canEditShifts && handleCellClick(member, day, false)}
                            onContextMenu={(e) => {
                              if (canEditShifts && shift) {
                                e.preventDefault();
                                handleCellClick(member, day, true);
                              }
                            }}
                            title={canEditShifts ? "Click to edit, Right-click to swap" : undefined}
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
                      <td className="p-1 text-center font-medium bg-red-100/30">{stats.leave || '-'}</td>
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
          <span className="text-muted-foreground">Morning</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors.afternoon)}>A</span>
          <span className="text-muted-foreground">Afternoon</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors.night)}>N</span>
          <span className="text-muted-foreground">Night</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors.general)}>G</span>
          <span className="text-muted-foreground">General</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors.leave)}>L</span>
          <span className="text-muted-foreground">Leave</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors['comp-off'])}>WO</span>
          <span className="text-muted-foreground">Weekly Off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center", shiftCellColors.off)}>-</span>
          <span className="text-muted-foreground">No Assignment</span>
        </div>
        {canEditShifts && (
          <div className="flex items-center gap-1.5 border-l pl-4 ml-2">
            <ArrowLeftRight size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">Right-click to swap</span>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <ShiftEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        member={editingMember}
        date={editingDate}
        currentShift={editingShift}
        onSave={handleShiftSave}
      />

      {/* Swap Dialog */}
      <ShiftSwapDialog
        open={swapDialogOpen}
        onOpenChange={setSwapDialogOpen}
        member={editingMember}
        date={editingDate}
        currentShift={editingShift}
        teamMembers={teamMembers}
        getShiftForMember={getMemberShift}
        onSwapComplete={handleSwapComplete}
      />
    </div>
  );
}
