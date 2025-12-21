import { useState, useMemo } from 'react';
import { ShiftAssignment, TeamMember, ShiftType, Department, DEPARTMENTS } from '@/types/roster';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Edit2, Building2 } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ExportDropdown } from './ExportDropdown';
import { ShiftEditDialog } from './ShiftEditDialog';
import { ShiftSwapDialog } from './ShiftSwapDialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DepartmentSheetViewProps {
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
  off: 'bg-muted text-muted-foreground',
};

const shiftLetters: Record<ShiftType, string> = {
  morning: 'M',
  afternoon: 'A',
  night: 'N',
  general: 'G',
  leave: 'L',
  'comp-off': 'WO',
};

export function DepartmentSheetView({ assignments, teamMembers, onShiftChange, onRefresh }: DepartmentSheetViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDepartment, setSelectedDepartment] = useState<Department>(DEPARTMENTS[0]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftType | null>(null);
  
  const { canEditShifts } = useAuth();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(startOfMonth(new Date()));

  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  // Group members by department
  const membersByDepartment = useMemo(() => {
    const grouped: Record<Department, TeamMember[]> = {} as Record<Department, TeamMember[]>;
    DEPARTMENTS.forEach(dept => {
      grouped[dept] = teamMembers.filter(m => m.department === dept);
    });
    return grouped;
  }, [teamMembers]);

  // Get department stats
  const getDepartmentStats = (dept: Department) => {
    const members = membersByDepartment[dept];
    const deptAssignments = assignments.filter(a => 
      members.some(m => m.id === a.memberId) &&
      monthDays.some(day => format(day, 'yyyy-MM-dd') === a.date)
    );
    
    return {
      total: members.length,
      shifts: deptAssignments.length,
      morning: deptAssignments.filter(a => a.shiftType === 'morning').length,
      afternoon: deptAssignments.filter(a => a.shiftType === 'afternoon').length,
      night: deptAssignments.filter(a => a.shiftType === 'night').length,
      general: deptAssignments.filter(a => a.shiftType === 'general').length,
      leave: deptAssignments.filter(a => a.shiftType === 'leave').length,
    };
  };

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

  const getReportingTL = (member: TeamMember): TeamMember | undefined => {
    if (member.reportingTLId) {
      return teamMembers.find(m => m.id === member.reportingTLId);
    }
    return undefined;
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

  const currentMembers = membersByDepartment[selectedDepartment] || [];

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
            <p className="text-sm text-muted-foreground">Department View</p>
          </div>
          {canEditShifts && (
            <Badge variant="outline" className="gap-1">
              <Edit2 size={12} />
              Edit Mode
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {!isCurrentMonth && (
            <Button variant="outline" onClick={goToCurrentMonth} className="gap-2">
              <Calendar size={16} />
              Today
            </Button>
          )}

          <ExportDropdown
            assignments={assignments}
            teamMembers={currentMembers}
            startDate={monthStart}
            endDate={monthEnd}
            viewType="monthly"
          />
        </div>
      </div>

      {/* Department Tabs */}
      <Tabs value={selectedDepartment} onValueChange={(v) => setSelectedDepartment(v as Department)}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {DEPARTMENTS.map(dept => {
            const stats = getDepartmentStats(dept);
            return (
              <TabsTrigger 
                key={dept} 
                value={dept}
                className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Building2 size={14} />
                {dept}
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {stats.total}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {DEPARTMENTS.map(dept => {
          const members = membersByDepartment[dept];
          const stats = getDepartmentStats(dept);
          
          return (
            <TabsContent key={dept} value={dept} className="mt-4">
              {/* Department Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
                <Card className="bg-card/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Members</p>
                  </CardContent>
                </Card>
                <Card className="bg-shift-morning/20">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">{stats.morning}</p>
                    <p className="text-xs text-muted-foreground">Morning</p>
                  </CardContent>
                </Card>
                <Card className="bg-shift-afternoon/20">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-sky-700">{stats.afternoon}</p>
                    <p className="text-xs text-muted-foreground">Afternoon</p>
                  </CardContent>
                </Card>
                <Card className="bg-shift-night/20">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-violet-700">{stats.night}</p>
                    <p className="text-xs text-muted-foreground">Night</p>
                  </CardContent>
                </Card>
                <Card className="bg-shift-general/20">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{stats.general}</p>
                    <p className="text-xs text-muted-foreground">General</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{stats.leave}</p>
                    <p className="text-xs text-muted-foreground">Leave</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{stats.shifts}</p>
                    <p className="text-xs text-muted-foreground">Total Shifts</p>
                  </CardContent>
                </Card>
              </div>

              {/* Department Sheet */}
              {members.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No members in this department</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        {/* Day names row */}
                        <tr className="border-b border-border/50 bg-muted/30">
                          <th className="sticky left-0 z-20 bg-muted/50 p-2 text-left font-medium min-w-[100px]">Manager</th>
                          <th className="sticky left-[100px] z-20 bg-muted/50 p-2 text-left font-medium min-w-[140px]">Name</th>
                          <th className="sticky left-[240px] z-20 bg-muted/50 p-2 text-left font-medium min-w-[60px]">Role</th>
                          {monthDays.map(day => (
                            <th 
                              key={format(day, 'yyyy-MM-dd')} 
                              className={cn(
                                "p-1 text-center font-normal min-w-[28px]",
                                isWeekend(day) && "bg-muted/50",
                                isToday(day) && "bg-primary/10"
                              )}
                            >
                              <div className="text-muted-foreground">{format(day, 'EEE').charAt(0)}</div>
                            </th>
                          ))}
                          <th className="p-1 text-center font-medium bg-shift-morning min-w-[24px]">M</th>
                          <th className="p-1 text-center font-medium bg-shift-afternoon min-w-[24px]">A</th>
                          <th className="p-1 text-center font-medium bg-shift-night min-w-[24px]">N</th>
                          <th className="p-1 text-center font-medium bg-shift-general min-w-[24px]">G</th>
                          <th className="p-1 text-center font-medium bg-red-100 min-w-[24px]">L</th>
                          <th className="p-1 text-center font-medium bg-muted min-w-[28px]">Off</th>
                        </tr>
                        {/* Day numbers row */}
                        <tr className="border-b border-border bg-muted/20">
                          <th className="sticky left-0 z-20 bg-muted/30 p-2"></th>
                          <th className="sticky left-[100px] z-20 bg-muted/30 p-2"></th>
                          <th className="sticky left-[240px] z-20 bg-muted/30 p-2"></th>
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
                        {members.map((member, memberIndex) => {
                          const memberStats = getMemberStats(member.id);
                          const reportingTL = getReportingTL(member);
                          
                          return (
                            <tr 
                              key={member.id} 
                              className={cn(
                                "border-b border-border/30 hover:bg-muted/20 transition-colors",
                                member.role === 'TL' && "bg-primary/5"
                              )}
                            >
                              {/* Manager/TL column */}
                              <td className="sticky left-0 z-10 bg-card p-2 font-medium text-muted-foreground truncate text-[11px]">
                                {member.role === 'TL' || member.role === 'HR' ? '-' : (reportingTL?.name || '-')}
                              </td>
                              {/* Member name */}
                              <td className="sticky left-[100px] z-10 bg-card p-2 font-medium">
                                <div className="truncate">{member.name}</div>
                              </td>
                              {/* Role */}
                              <td className="sticky left-[240px] z-10 bg-card p-2">
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
                                      canEditShifts && "cursor-pointer hover:bg-muted/50"
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
                                        "inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold",
                                        shiftCellColors[shift]
                                      )}>
                                        {shiftLetters[shift]}
                                      </span>
                                    ) : (
                                      <span className={cn(
                                        "inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-medium",
                                        shiftCellColors.off
                                      )}>
                                        -
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              {/* Summary columns */}
                              <td className="p-1 text-center font-medium bg-shift-morning/30">{memberStats.morning || '-'}</td>
                              <td className="p-1 text-center font-medium bg-shift-afternoon/30">{memberStats.afternoon || '-'}</td>
                              <td className="p-1 text-center font-medium bg-shift-night/30">{memberStats.night || '-'}</td>
                              <td className="p-1 text-center font-medium bg-shift-general/30">{memberStats.general || '-'}</td>
                              <td className="p-1 text-center font-medium bg-red-100/30">{memberStats.leave || '-'}</td>
                              <td className="p-1 text-center font-medium bg-muted/50">{memberStats.off}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Edit Dialog */}
      {editingMember && editingDate && (
        <ShiftEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          member={editingMember}
          date={editingDate}
          currentShift={editingShift}
          onSave={handleShiftSave}
        />
      )}

      {/* Swap Dialog */}
      {editingMember && editingDate && editingShift && (
        <ShiftSwapDialog
          open={swapDialogOpen}
          onOpenChange={setSwapDialogOpen}
          member={editingMember}
          date={editingDate}
          currentShift={editingShift}
          teamMembers={currentMembers}
          getShiftForMember={(memberId, date) => getMemberShift(memberId, date)}
          onSwapComplete={handleSwapComplete}
        />
      )}
    </div>
  );
}