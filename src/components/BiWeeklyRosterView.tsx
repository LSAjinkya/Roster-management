import { useState, useMemo } from 'react';
import { ShiftAssignment, TeamMember, ShiftType, Department, DEPARTMENTS, TeamGroup, TEAM_GROUPS, SHIFT_DEFINITIONS } from '@/types/roster';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Edit2, ArrowLeftRight, Users, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { 
  format, 
  addDays, 
  subDays,
  isToday,
  isWeekend,
  startOfWeek
} from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShiftEditDialog } from './ShiftEditDialog';
import { ShiftSwapDialog } from './ShiftSwapDialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { exportToCSV, exportTeamWisePDF } from '@/utils/exportRoster';

interface BiWeeklyRosterViewProps {
  assignments: ShiftAssignment[];
  teamMembers: TeamMember[];
  onShiftChange?: (memberId: string, date: string, shiftType: ShiftType | 'off') => void;
  onRefresh?: () => void;
}

const shiftCellColors: Record<ShiftType | 'off', string> = {
  morning: 'bg-shift-morning text-amber-900 border-amber-300',
  afternoon: 'bg-shift-afternoon text-sky-900 border-sky-300',
  night: 'bg-shift-night text-violet-900 border-violet-300',
  general: 'bg-shift-general text-emerald-900 border-emerald-300',
  leave: 'bg-red-100 text-red-700 border-red-300',
  'comp-off': 'bg-orange-100 text-orange-700 border-orange-300',
  'week-off': 'bg-gray-200 text-gray-700 border-gray-300',
  'public-off': 'bg-blue-100 text-blue-700 border-blue-300',
  'paid-leave': 'bg-green-100 text-green-700 border-green-300',
  off: 'bg-muted text-muted-foreground border-muted',
};

const shiftLabels: Record<ShiftType, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
  general: 'General',
  leave: 'Leave',
  'comp-off': 'Comp Off',
  'week-off': 'Week Off',
  'public-off': 'Public Holiday',
  'paid-leave': 'Paid Leave',
};

export function BiWeeklyRosterView({ assignments, teamMembers, onShiftChange, onRefresh }: BiWeeklyRosterViewProps) {
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState<TeamGroup | 'all'>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftType | null>(null);
  
  const { canEditShifts } = useAuth();

  // 14 days from start date
  const days = useMemo(() => 
    Array.from({ length: 14 }, (_, i) => addDays(startDate, i)), 
    [startDate]
  );

  const goToPrevious = () => setStartDate(prev => subDays(prev, 14));
  const goToNext = () => setStartDate(prev => addDays(prev, 14));
  const goToToday = () => setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const endDate = addDays(startDate, 13);
  const isCurrent = days.some(day => isToday(day));

  // Filter members
  const filteredMembers = useMemo(() => {
    let members = teamMembers;
    if (departmentFilter !== 'all') {
      members = members.filter(m => m.department === departmentFilter);
    }
    if (teamFilter !== 'all') {
      members = members.filter(m => m.team === teamFilter);
    }
    return members;
  }, [teamMembers, departmentFilter, teamFilter]);

  // Group members by department
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

  const getShiftForMember = (memberId: string, date: Date): ShiftType | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const assignment = assignments.find(a => a.memberId === memberId && a.date === dateStr);
    return assignment?.shiftType || null;
  };

  const handleCellClick = (member: TeamMember, day: Date) => {
    if (!canEditShifts) {
      toast.error('You do not have permission to edit shifts');
      return;
    }
    
    const shift = getMemberShift(member.id, day);
    setEditingMember(member);
    setEditingDate(day);
    setEditingShift(shift);
    setEditDialogOpen(true);
  };

  const handleSwapClick = (member: TeamMember, day: Date) => {
    if (!canEditShifts) {
      toast.error('You do not have permission to edit shifts');
      return;
    }
    
    const shift = getMemberShift(member.id, day);
    if (!shift || ['leave', 'comp-off', 'week-off', 'public-off', 'paid-leave'].includes(shift)) {
      toast.error('Cannot swap non-work shifts');
      return;
    }
    
    setEditingMember(member);
    setEditingDate(day);
    setEditingShift(shift);
    setSwapDialogOpen(true);
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
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header Controls */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPrevious}>
                <ChevronLeft size={18} />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNext}>
                <ChevronRight size={18} />
              </Button>
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
              </h2>
              <p className="text-sm text-muted-foreground">
                14-Day View • {filteredMembers.length} members
              </p>
            </div>
            {canEditShifts && (
              <Badge variant="outline" className="gap-1">
                <Edit2 size={12} />
                Click to Edit
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

            {!isCurrent && (
              <Button variant="outline" onClick={goToToday} className="gap-2">
                <Calendar size={16} />
                Today
              </Button>
            )}

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download size={16} />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  className="gap-2 cursor-pointer"
                  onClick={() => {
                    exportToCSV({ 
                      assignments, 
                      teamMembers: filteredMembers, 
                      startDate, 
                      endDate, 
                      viewType: 'biweekly' 
                    });
                    toast.success('CSV downloaded successfully');
                  }}
                >
                  <FileSpreadsheet size={16} />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 cursor-pointer"
                  onClick={() => {
                    exportTeamWisePDF({ 
                      assignments, 
                      teamMembers: filteredMembers, 
                      startDate, 
                      endDate, 
                      viewType: 'biweekly' 
                    });
                    toast.success('PDF generated - use Print dialog to save');
                  }}
                >
                  <FileText size={16} />
                  Export Team PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Roster Grid with Larger Cells */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {/* Day names row */}
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="sticky left-0 z-20 bg-muted/50 p-3 text-left font-medium min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <Users size={16} />
                      Member
                    </div>
                  </th>
                  {days.map(day => (
                    <th 
                      key={format(day, 'yyyy-MM-dd')} 
                      className={cn(
                        "p-2 text-center font-normal min-w-[80px]",
                        isWeekend(day) && "bg-muted/50",
                        isToday(day) && "bg-primary/20"
                      )}
                    >
                      <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                      <div className={cn(
                        "text-lg font-semibold mt-1",
                        isToday(day) && "text-primary"
                      )}>
                        {format(day, 'd')}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{format(day, 'MMM')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(membersByDepartment).map(([department, members]) => (
                  <>
                    {/* Department header */}
                    <tr key={`dept-${department}`} className="bg-muted/20">
                      <td 
                        colSpan={15} 
                        className="sticky left-0 z-10 p-2 font-semibold text-sm text-muted-foreground"
                      >
                        {department} ({members.length})
                      </td>
                    </tr>
                    {members.map((member) => (
                      <tr 
                        key={member.id} 
                        className="border-b border-border/30 hover:bg-muted/10 transition-colors"
                      >
                        {/* Member info */}
                        <td className="sticky left-0 z-10 bg-card p-3 font-medium">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn(
                              "text-[10px] px-1.5",
                              member.team === 'Alpha' ? 'bg-blue-500/20 text-blue-700 border-blue-500/30' :
                              member.team === 'Gamma' ? 'bg-green-500/20 text-green-700 border-green-500/30' :
                              member.team === 'Beta' ? 'bg-orange-500/20 text-orange-700 border-orange-500/30' :
                              'bg-muted text-muted-foreground'
                            )}>
                              {member.team || 'N/A'}
                            </Badge>
                            <div>
                              <div className="font-medium text-sm truncate max-w-[100px]">{member.name}</div>
                              <div className="text-[10px] text-muted-foreground">{member.role}</div>
                            </div>
                          </div>
                        </td>
                        {/* Day cells - larger for easier editing */}
                        {days.map(day => {
                          const shift = getMemberShift(member.id, day);
                          const weekend = isWeekend(day);
                          const today = isToday(day);
                          const isWorkShift = shift && !['leave', 'comp-off', 'week-off', 'public-off', 'paid-leave'].includes(shift);
                          
                          return (
                            <td 
                              key={format(day, 'yyyy-MM-dd')}
                              className={cn(
                                "p-1.5 text-center",
                                weekend && !shift && "bg-muted/30",
                                today && "ring-2 ring-primary ring-inset",
                                canEditShifts && "cursor-pointer"
                              )}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    className={cn(
                                      "flex flex-col items-center justify-center min-h-[48px] rounded-lg border-2 transition-all",
                                      shift ? shiftCellColors[shift] : 'bg-muted/30 border-muted text-muted-foreground',
                                      canEditShifts && "hover:scale-105 hover:shadow-md active:scale-95"
                                    )}
                                    onClick={() => handleCellClick(member, day)}
                                    onContextMenu={(e) => {
                                      if (canEditShifts && isWorkShift) {
                                        e.preventDefault();
                                        handleSwapClick(member, day);
                                      }
                                    }}
                                  >
                                    <span className="text-sm font-bold">
                                      {shift ? (
                                        shift === 'morning' ? 'M' :
                                        shift === 'afternoon' ? 'A' :
                                        shift === 'night' ? 'N' :
                                        shift === 'general' ? 'G' :
                                        shift === 'leave' ? 'UL' :
                                        shift === 'comp-off' ? 'CO' :
                                        shift === 'week-off' ? 'OFF' :
                                        shift === 'public-off' ? 'PO' :
                                        shift === 'paid-leave' ? 'PL' : '-'
                                      ) : '-'}
                                    </span>
                                    {isWorkShift && canEditShifts && (
                                      <ArrowLeftRight size={10} className="mt-0.5 opacity-50" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <div className="font-semibold">{member.name}</div>
                                    <div>{format(day, 'EEEE, MMM d')}</div>
                                    <div className="mt-1">
                                      {shift ? shiftLabels[shift] : 'No assignment'}
                                    </div>
                                    {canEditShifts && (
                                      <div className="mt-1 text-muted-foreground">
                                        Click to edit{isWorkShift ? ' • Right-click to swap' : ''}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 px-2">
          {SHIFT_DEFINITIONS.map(shift => (
            <div 
              key={shift.id}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
                shiftCellColors[shift.id]
              )}
            >
              <span className="font-bold">
                {shift.id === 'morning' ? 'M' :
                 shift.id === 'afternoon' ? 'A' :
                 shift.id === 'night' ? 'N' :
                 shift.id === 'general' ? 'G' :
                 shift.id === 'leave' ? 'UL' :
                 shift.id === 'comp-off' ? 'CO' :
                 shift.id === 'week-off' ? 'OFF' :
                 shift.id === 'public-off' ? 'PO' : 'PL'}
              </span>
              <span>
                {shift.id === 'leave' ? 'Unpaid OFF' :
                 shift.id === 'comp-off' ? 'Comp OFF' :
                 shift.id === 'week-off' ? 'Weekly OFF' :
                 shift.id === 'public-off' ? 'Public OFF' :
                 shift.id === 'paid-leave' ? 'Paid OFF' : shift.name}
              </span>
            </div>
          ))}
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
          currentShift={editingShift as ShiftType}
          teamMembers={filteredMembers}
          getShiftForMember={getShiftForMember}
          onSwapComplete={handleSwapComplete}
        />
      </div>
    </TooltipProvider>
  );
}
