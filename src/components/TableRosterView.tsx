import { useState, useMemo, useEffect } from 'react';
import { ShiftAssignment, TeamMember, ShiftType, Department, DEPARTMENTS, TeamGroup, TEAM_GROUPS, WorkLocation } from '@/types/roster';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Edit2, ArrowLeftRight, Home } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';

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
  leave: 'UL',
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
  const [shiftFilter, setShiftFilter] = useState<ShiftType | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftType | null>(null);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  
  const { canEditShifts, isTL, user } = useAuth();

  // Fetch work locations
  useEffect(() => {
    const fetchWorkLocations = async () => {
      const { data, error } = await supabase
        .from('work_locations')
        .select('*')
        .eq('is_active', true)
        .order('location_type', { ascending: true })
        .order('city', { ascending: true })
        .order('name', { ascending: true });

      if (!error && data) {
        setWorkLocations(data.map(l => ({
          id: l.id,
          name: l.name,
          code: l.code,
          is_active: l.is_active,
          min_night_shift_count: l.min_night_shift_count,
          work_from_home_if_below_min: l.work_from_home_if_below_min,
          location_type: l.location_type as 'office' | 'datacenter' | 'remote' | undefined,
          city: l.city || undefined,
        })));
      }
    };
    fetchWorkLocations();
  }, []);

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

  // Filter members by department, team, TL, shift and location
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
    if (locationFilter !== 'all') {
      if (locationFilter === 'unassigned') {
        members = members.filter(m => !m.workLocationId);
      } else {
        members = members.filter(m => m.workLocationId === locationFilter);
      }
    }
    // Filter by shift: only show members who have the selected shift type in the current month
    if (shiftFilter !== 'all') {
      const monthStartStr = format(monthStart, 'yyyy-MM-dd');
      const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
      const memberIdsWithShift = new Set(
        assignments
          .filter(a => a.date >= monthStartStr && a.date <= monthEndStr && a.shiftType === shiftFilter)
          .map(a => a.memberId)
      );
      members = members.filter(m => memberIdsWithShift.has(m.id));
    }
    return members;
  }, [teamMembers, departmentFilter, teamFilter, tlFilter, locationFilter, shiftFilter, assignments, monthStart, monthEnd]);

  // Calculate single-person night shift WFH situations
  const singlePersonNightWfh = useMemo(() => {
    const wfhCells: Map<string, boolean> = new Map(); // key: `${memberId}-${date}`
    
    monthDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const nightAssignments = assignments.filter(a => a.date === dateStr && a.shiftType === 'night');
      
      // Group by location
      const locationGroups: Map<string, string[]> = new Map();
      nightAssignments.forEach(a => {
        const member = teamMembers.find(m => m.id === a.memberId);
        const locationId = member?.workLocationId || 'unassigned';
        if (!locationGroups.has(locationId)) {
          locationGroups.set(locationId, []);
        }
        locationGroups.get(locationId)!.push(a.memberId);
      });

      // Check each location for single-person situations
      locationGroups.forEach((memberIds, locationId) => {
        if (memberIds.length === 1 && locationId !== 'unassigned') {
          const location = workLocations.find(l => l.id === locationId);
          if (location && location.location_type === 'office' && location.work_from_home_if_below_min) {
            wfhCells.set(`${memberIds[0]}-${dateStr}`, true);
          }
        }
      });
    });
    
    return wfhCells;
  }, [assignments, teamMembers, monthDays, workLocations]);

  const isSinglePersonWfh = (memberId: string, date: Date): boolean => {
    return singlePersonNightWfh.has(`${memberId}-${format(date, 'yyyy-MM-dd')}`);
  };

  // Group office locations by city for filters
  const officeLocationsByCity = useMemo(() => {
    const grouped: Map<string, WorkLocation[]> = new Map();
    workLocations.filter(l => l.location_type === 'office').forEach(loc => {
      const city = loc.city || 'Other';
      if (!grouped.has(city)) {
        grouped.set(city, []);
      }
      grouped.get(city)!.push(loc);
    });
    return grouped;
  }, [workLocations]);

  const dcLocations = useMemo(() => {
    return workLocations.filter(l => l.location_type === 'datacenter');
  }, [workLocations]);

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
      <div className="bg-card p-4 rounded-xl border border-border/50 space-y-4">
        {/* Top Row: Navigation and Month Info */}
        <div className="flex items-center justify-between">
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
          
          <div className="flex items-center gap-2">
            {!isCurrentMonth && (
              <Button variant="outline" onClick={goToCurrentMonth} className="gap-2" size="sm">
                <Calendar size={14} />
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
        
        {/* Filter Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v as Department | 'all')}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
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
            <SelectTrigger className="w-[110px] h-9 text-sm">
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
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue placeholder="All TLs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All TLs</SelectItem>
              {tlMembers.map(tl => (
                <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={shiftFilter} onValueChange={(v) => setShiftFilter(v as ShiftType | 'all')}>
            <SelectTrigger className="w-[110px] h-9 text-sm">
              <SelectValue placeholder="All Shifts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shifts</SelectItem>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="afternoon">Afternoon</SelectItem>
              <SelectItem value="night">Night</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>

          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {Array.from(officeLocationsByCity.entries()).map(([city, locs]) => (
                locs.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))
              ))}
              {dcLocations.length > 0 && (
                <>
                  {dcLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      DC: {loc.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-30">
              {/* Header row with Manager, Name, Level - spanning 2 rows */}
              <tr className="border-b border-border/50 bg-muted">
                <th rowSpan={2} className="sticky left-0 z-40 bg-muted p-2 text-left font-medium w-[120px] min-w-[120px] max-w-[120px] border-r border-border/30 align-middle">Manager</th>
                <th rowSpan={2} className="sticky left-[120px] z-40 bg-muted p-2 text-left font-medium w-[140px] min-w-[140px] max-w-[140px] border-r border-border/30 align-middle">Name</th>
                <th rowSpan={2} className="sticky left-[260px] z-40 bg-muted p-2 text-left font-medium w-[80px] min-w-[80px] max-w-[80px] border-r border-border/30 align-middle">Level</th>
                {monthDays.map(day => (
                  <th 
                    key={format(day, 'yyyy-MM-dd')} 
                    className={cn(
                      "p-1 text-center font-normal w-[32px] min-w-[32px] max-w-[32px] bg-muted",
                      isWeekend(day) && "bg-muted/80",
                      isToday(day) && "bg-primary/20"
                    )}
                  >
                    <div className="text-muted-foreground text-[10px]">{format(day, 'EEE').charAt(0)}</div>
                  </th>
                ))}
                <th rowSpan={2} className="p-1 text-center font-medium bg-shift-morning w-[28px] min-w-[28px] align-middle">M</th>
                <th rowSpan={2} className="p-1 text-center font-medium bg-shift-afternoon w-[28px] min-w-[28px] align-middle">A</th>
                <th rowSpan={2} className="p-1 text-center font-medium bg-shift-night w-[28px] min-w-[28px] align-middle">N</th>
                <th rowSpan={2} className="p-1 text-center font-medium bg-shift-general w-[28px] min-w-[28px] align-middle">G</th>
                <th rowSpan={2} className="p-1 text-center font-medium bg-red-100 w-[28px] min-w-[28px] align-middle">L</th>
                <th rowSpan={2} className="p-1 text-center font-medium bg-muted w-[32px] min-w-[32px] align-middle">Off</th>
                <th rowSpan={2} className="p-1 text-center font-medium w-[40px] min-w-[40px] align-middle">Total</th>
              </tr>
              {/* Day numbers row */}
              <tr className="border-b border-border bg-muted/80">
                {monthDays.map(day => (
                  <th 
                    key={format(day, 'yyyy-MM-dd')} 
                    className={cn(
                      "p-1 text-center font-semibold bg-muted/80 w-[32px] min-w-[32px] max-w-[32px]",
                      isWeekend(day) && "bg-muted text-muted-foreground",
                      isToday(day) && "bg-primary text-primary-foreground rounded"
                    )}
                  >
                    {format(day, 'd')}
                  </th>
                ))}
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
                              <span className="inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-medium text-muted-foreground">
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
                        <div className="flex items-center gap-1">
                          {member.datacenterCode && (
                            <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                              {member.datacenterCode}
                            </span>
                          )}
                          <span className="truncate">{member.name}</span>
                        </div>
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
                        const isWfhSinglePerson = shift === 'night' && isSinglePersonWfh(member.id, day);
                        
                        return (
                          <TooltipProvider key={format(day, 'yyyy-MM-dd')}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <td 
                                  className={cn(
                                    "p-0.5 text-center relative",
                                    weekend && !shift && "bg-muted/30",
                                    today && "ring-1 ring-primary ring-inset",
                                    canEditShifts && "cursor-pointer hover:bg-primary/10",
                                    isWfhSinglePerson && "bg-cyan-100/50"
                                  )}
                                  onClick={() => canEditShifts && handleCellClick(member, day, false)}
                                  onContextMenu={(e) => {
                                    if (canEditShifts && shift) {
                                      e.preventDefault();
                                      handleCellClick(member, day, true);
                                    }
                                  }}
                                >
                                  {shift ? (
                                    <span className={cn(
                                      "inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-bold",
                                      shiftCellColors[shift]
                                    )}>
                                      {shiftLetters[shift]}
                                      {isWfhSinglePerson && (
                                        <Home size={8} className="absolute -top-0.5 -right-0.5 text-cyan-600" />
                                      )}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-medium text-muted-foreground">
                                      -
                                    </span>
                                  )}
                                </td>
                              </TooltipTrigger>
                              {isWfhSinglePerson && (
                                <TooltipContent>
                                  <p className="text-xs">Single person at location - WFH</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
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
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors.leave)}>UL</span>
          <span className="text-muted-foreground">Unpaid OFF</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors['week-off'])}>OFF</span>
          <span className="text-muted-foreground">Weekly OFF</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-5 h-4 rounded flex items-center justify-center font-bold", shiftCellColors['comp-off'])}>CO</span>
          <span className="text-muted-foreground">Comp OFF</span>
        </div>
        {canEditShifts && (
          <div className="flex items-center gap-1.5 border-l pl-4 ml-2">
            <ArrowLeftRight size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">Right-click to swap</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 border-l pl-4 ml-2">
          <Home size={14} className="text-cyan-600" />
          <span className="text-muted-foreground">Single person WFH</span>
        </div>
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
