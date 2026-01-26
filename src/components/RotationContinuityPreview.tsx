import { useMemo, useState, useEffect } from 'react';
import { format, addMonths, startOfMonth, subDays, eachDayOfInterval, endOfMonth } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TeamMember, ShiftType, Department } from '@/types/roster';
import { SHIFT_ROTATION_ORDER, ROTATING_DEPARTMENTS, WORK_DAYS_IN_CYCLE } from '@/types/shiftRules';
import { ArrowRight, Moon, Sun, Sunrise, Calendar, AlertTriangle, MapPin, Building2, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PreviousMonthState {
  shift: ShiftType;
  workDaysInCurrent: number;
  offDaysUsed: number;
}

interface RotationContinuityPreviewProps {
  teamMembers: TeamMember[];
  previousMonthState: Record<string, PreviousMonthState>;
  onContinuityChange?: (memberId: string, newShift: ShiftType, workDays: number) => void;
}

interface WorkLocation {
  id: string;
  name: string;
  code: string;
  city: string;
}

interface LastWeekAssignment {
  memberId: string;
  date: string;
  shiftType: ShiftType;
}

const SHIFT_CONFIG: Record<string, { icon: typeof Sun; color: string; label: string; letter: string }> = {
  morning: { icon: Sunrise, color: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Morning', letter: 'M' },
  afternoon: { icon: Sun, color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Afternoon', letter: 'A' },
  night: { icon: Moon, color: 'bg-purple-100 text-purple-700 border-purple-300', label: 'Night', letter: 'N' },
  general: { icon: Calendar, color: 'bg-gray-100 text-gray-700 border-gray-300', label: 'General', letter: 'G' },
  'week-off': { icon: Calendar, color: 'bg-orange-100 text-orange-700 border-orange-300', label: 'OFF', letter: 'O' },
  leave: { icon: Calendar, color: 'bg-red-100 text-red-700 border-red-300', label: 'L', letter: 'L' },
  'comp-off': { icon: Calendar, color: 'bg-teal-100 text-teal-700 border-teal-300', label: 'CO', letter: 'CO' },
};

// Only rotating shifts - General is for TL/Managers only (not in rotation)
const ROTATING_SHIFT_TYPES: ShiftType[] = ['afternoon', 'morning', 'night'];
const SHIFT_TYPES: ShiftType[] = ['morning', 'afternoon', 'night', 'general'];

export function RotationContinuityPreview({ 
  teamMembers, 
  previousMonthState, 
  onContinuityChange 
}: RotationContinuityPreviewProps) {
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  // workDays: 1-10 = Day 1-10, 11 = OFF 1st, 12 = OFF 2nd, 13 = OFF 3rd, 14 = OFF 4th
  const [localOverrides, setLocalOverrides] = useState<Record<string, { shift: ShiftType; workDays: number }>>({});
  const [lastWeekAssignments, setLastWeekAssignments] = useState<LastWeekAssignment[]>([]);

  const nextMonth = addMonths(new Date(), 1);
  const monthName = format(nextMonth, 'MMMM yyyy');
  
  // Last 7 days of previous month (current month's last week)
  const currentMonthEnd = endOfMonth(new Date());
  const lastWeekStart = subDays(currentMonthEnd, 6);
  const lastWeekDays = eachDayOfInterval({ start: lastWeekStart, end: currentMonthEnd });

  // Fetch work locations and last week assignments
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase
        .from('work_locations')
        .select('id, name, code, city')
        .eq('is_active', true)
        .order('name');
      if (data) setWorkLocations(data);
    };
    
    const fetchLastWeekAssignments = async () => {
      const startDate = format(lastWeekStart, 'yyyy-MM-dd');
      const endDate = format(currentMonthEnd, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('member_id, date, shift_type')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');
      
      if (data && !error) {
        setLastWeekAssignments(data.map(d => ({
          memberId: d.member_id,
          date: d.date,
          shiftType: d.shift_type as ShiftType
        })));
      }
    };
    
    fetchLocations();
    fetchLastWeekAssignments();
  }, []);

  // Calculate continuation for each member with local overrides
  // workDays encoding: 1-10 = Day 1-10, 11 = OFF 1st, 12 = OFF 2nd, 13 = OFF 3rd, 14 = OFF 4th
  const continuityData = useMemo(() => {
    const rotatingMembers = teamMembers.filter(
      m => ROTATING_DEPARTMENTS.includes(m.department) && m.role !== 'TL' && m.role !== 'Manager'
    );

    return rotatingMembers.map(member => {
      const override = localOverrides[member.id];
      const prevState = previousMonthState[member.id];
      
      if (!prevState && !override) {
        return {
          member,
          hasPreviousData: false,
          currentShift: 'afternoon' as ShiftType,
          workDaysCompleted: 0,
          workDaysRemaining: WORK_DAYS_IN_CYCLE,
          nextShift: 'afternoon' as ShiftType,
          startsWithOff: false,
          offDaysNeeded: 0,
          isOnOff1: false,
          isOnOff2: false,
          isOnOff3: false,
          isOnOff4: false,
        };
      }

      const currentShift = override?.shift || prevState?.shift || 'afternoon';
      const rawWorkDays = override?.workDays ?? prevState?.workDaysInCurrent ?? 0;
      
      // Check if currently on OFF days (11 = OFF 1st, 12 = OFF 2nd, 13 = OFF 3rd, 14 = OFF 4th)
      const isOnOff1 = rawWorkDays === 11;
      const isOnOff2 = rawWorkDays === 12;
      const isOnOff3 = rawWorkDays === 13;
      const isOnOff4 = rawWorkDays === 14;
      const isOnOff = isOnOff1 || isOnOff2 || isOnOff3 || isOnOff4;
      
      // Actual work days completed (max 10 for display)
      const workDaysCompleted = isOnOff ? WORK_DAYS_IN_CYCLE : Math.min(rawWorkDays, WORK_DAYS_IN_CYCLE);
      const workDaysRemaining = isOnOff ? 0 : WORK_DAYS_IN_CYCLE - workDaysCompleted;
      
      // Determine OFF days needed at month start
      // OFF 1st = 11: need 3 more OFF (2nd, 3rd, 4th), then rotate
      // OFF 2nd = 12: need 2 more OFF (3rd, 4th), then rotate
      // OFF 3rd = 13: need 1 more OFF (4th), then rotate
      // OFF 4th = 14: OFF complete, start Day 1 of new shift
      // Completed 10 days: Need 4 OFFs before rotating
      const needsOff = workDaysCompleted >= WORK_DAYS_IN_CYCLE || isOnOff;
      
      // OFF days needed in the NEW month
      let offDaysNeeded = 0;
      if (isOnOff4) {
        offDaysNeeded = 0; // OFF complete
      } else if (isOnOff3) {
        offDaysNeeded = 1;
      } else if (isOnOff2) {
        offDaysNeeded = 2;
      } else if (isOnOff1) {
        offDaysNeeded = 3;
      } else if (needsOff) {
        offDaysNeeded = 4; // Full 4 OFF days
      }
      
      // Calculate next shift after OFF
      const currentShiftIndex = SHIFT_ROTATION_ORDER.indexOf(currentShift as any);
      const nextShiftAfterOff = (needsOff || isOnOff) 
        ? SHIFT_ROTATION_ORDER[(currentShiftIndex + 1) % 3]
        : currentShift;

      return {
        member,
        hasPreviousData: true,
        currentShift,
        workDaysCompleted,
        workDaysRemaining,
        nextShift: nextShiftAfterOff,
        startsWithOff: needsOff || isOnOff,
        offDaysNeeded: Math.max(0, offDaysNeeded),
        isOnOff1,
        isOnOff2,
        isOnOff3,
        isOnOff4,
      };
    });
  }, [teamMembers, previousMonthState, localOverrides]);

  // Group by department
  const departmentGroups = useMemo(() => {
    const groups: Record<string, typeof continuityData> = {};
    continuityData.forEach(data => {
      const dept = data.member.department;
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(data);
    });
    return groups;
  }, [continuityData]);

  // Group by location
  const locationGroups = useMemo(() => {
    const groups: Record<string, { location: WorkLocation | null; members: typeof continuityData }> = {};
    
    continuityData.forEach(data => {
      const locationId = (data.member as any).work_location_id || 'unknown';
      if (!groups[locationId]) {
        const location = workLocations.find(l => l.id === locationId) || null;
        groups[locationId] = { location, members: [] };
      }
      groups[locationId].members.push(data);
    });
    return groups;
  }, [continuityData, workLocations]);

  type WorkShiftType = 'morning' | 'afternoon' | 'night' | 'general';

  // Calculate shift distribution per department
  const departmentShiftStats = useMemo(() => {
    const stats: Record<string, Record<WorkShiftType, number>> = {};
    
    Object.entries(departmentGroups).forEach(([dept, members]) => {
      stats[dept] = { morning: 0, afternoon: 0, night: 0, general: 0 };
      members.forEach(m => {
        const shift = m.startsWithOff ? m.nextShift : m.currentShift;
        if (shift in stats[dept]) {
          stats[dept][shift as WorkShiftType]++;
        }
      });
    });
    
    return stats;
  }, [departmentGroups]);

  // Calculate location shift distribution
  const locationShiftStats = useMemo(() => {
    const stats: Record<string, Record<WorkShiftType, number>> = {};
    
    Object.entries(locationGroups).forEach(([locId, { members }]) => {
      stats[locId] = { morning: 0, afternoon: 0, night: 0, general: 0 };
      members.forEach(m => {
        const shift = m.startsWithOff ? m.nextShift : m.currentShift;
        if (shift in stats[locId]) {
          stats[locId][shift as WorkShiftType]++;
        }
      });
    });
    
    return stats;
  }, [locationGroups]);

  // Detect weekend clustering issues (too many people off on Sat-Sun)
  const weekendClusteringWarnings = useMemo(() => {
    // In a proper implementation, this would check actual week-off patterns
    // For now, flag if more than 50% of a department starts with OFF or has weekend patterns
    const warnings: string[] = [];
    
    Object.entries(departmentGroups).forEach(([dept, members]) => {
      const startsWithOff = members.filter(m => m.startsWithOff).length;
      if (members.length > 3 && startsWithOff > members.length * 0.4) {
        warnings.push(`${dept}: ${startsWithOff} of ${members.length} members starting with week-off - consider staggering`);
      }
    });
    
    return warnings;
  }, [departmentGroups]);

  const handleShiftChange = (memberId: string, newShift: ShiftType) => {
    const current = localOverrides[memberId] || { 
      shift: previousMonthState[memberId]?.shift || 'afternoon',
      workDays: previousMonthState[memberId]?.workDaysInCurrent || 0
    };
    setLocalOverrides(prev => ({
      ...prev,
      [memberId]: { ...current, shift: newShift }
    }));
    onContinuityChange?.(memberId, newShift, current.workDays);
  };

  const handleWorkDaysChange = (memberId: string, workDays: number) => {
    const current = localOverrides[memberId] || { 
      shift: previousMonthState[memberId]?.shift || 'afternoon',
      workDays: previousMonthState[memberId]?.workDaysInCurrent || 0
    };
    setLocalOverrides(prev => ({
      ...prev,
      [memberId]: { ...current, workDays }
    }));
    onContinuityChange?.(memberId, current.shift, workDays);
  };

  // Get member's last week shifts
  const getMemberLastWeek = (memberId: string) => {
    return lastWeekDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const assignment = lastWeekAssignments.find(a => a.memberId === memberId && a.date === dateStr);
      return {
        date: day,
        dateStr,
        shift: assignment?.shiftType || null
      };
    });
  };

  const getShiftLetter = (shift: ShiftType | null): string => {
    if (!shift) return '-';
    const config = SHIFT_CONFIG[shift];
    return config?.letter || shift.charAt(0).toUpperCase();
  };

  const getShiftCellStyle = (shift: ShiftType | null): string => {
    if (!shift) return 'bg-muted/50 text-muted-foreground';
    return SHIFT_CONFIG[shift]?.color || 'bg-muted text-foreground';
  };

  const renderMemberRow = (data: typeof continuityData[0], editable = true) => {
    const ShiftIcon = SHIFT_CONFIG[data.currentShift]?.icon || Sun;
    const NextShiftIcon = SHIFT_CONFIG[data.nextShift]?.icon || Sun;
    const isEditing = editingMember === data.member.id;
    const isEditingNext = editingMember === `${data.member.id}_next`;
    
    // Determine continuity status for visual indicator
    const isContinuing = data.hasPreviousData && data.workDaysCompleted > 0;
    const isStartingFresh = !data.hasPreviousData || data.workDaysCompleted === 0;
    const isTransitioning = data.startsWithOff;
    
    // Get last week data for this member
    const memberLastWeek = getMemberLastWeek(data.member.id);
    
    return (
      <div
        key={data.member.id}
        className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors gap-3"
      >
        <div className="flex items-center gap-3 min-w-[180px]">
          {/* Continuity Status Indicator */}
          <div className="flex-shrink-0">
            {isContinuing && !isTransitioning && (
              <div 
                className="w-2 h-2 rounded-full bg-blue-500" 
                title="Continuing from last month"
              />
            )}
            {isTransitioning && (
              <div 
                className="w-2 h-2 rounded-full bg-amber-500" 
                title="Transitioning (week-off then new shift)"
              />
            )}
            {isStartingFresh && !isTransitioning && (
              <div 
                className="w-2 h-2 rounded-full bg-emerald-500" 
                title="Starting fresh cycle"
              />
            )}
          </div>
          <div className="w-28 truncate font-medium text-sm">
            {data.member.name}
          </div>
          <Badge variant="outline" className="text-xs">
            {data.member.role}
          </Badge>
        </div>

        {/* Last Week of Previous Month - Visual Grid */}
        <div className="flex items-center gap-0.5 shrink-0">
          {memberLastWeek.map(({ date, dateStr, shift }) => (
            <div
              key={dateStr}
              className={`w-7 h-7 flex items-center justify-center rounded text-[10px] font-medium border ${getShiftCellStyle(shift)}`}
              title={`${format(date, 'EEE, MMM d')}: ${shift || 'No data'}`}
            >
              {getShiftLetter(shift)}
            </div>
          ))}
        </div>

        {/* Arrow separator */}
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

        {data.hasPreviousData ? (
          <div className="flex items-center gap-2">
            {/* Editable Current State */}
            {editable && isEditing ? (
              <div className="flex items-center gap-2">
                <Select 
                  value={data.currentShift} 
                  onValueChange={(v) => handleShiftChange(data.member.id, v as ShiftType)}
                >
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROTATING_SHIFT_TYPES.map(s => (
                      <SelectItem key={s} value={s}>
                        {SHIFT_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={data.isOnOff4 ? 'off4' : (data.isOnOff3 ? 'off3' : (data.isOnOff2 ? 'off2' : (data.isOnOff1 ? 'off1' : String(data.workDaysCompleted || 1))))} 
                  onValueChange={(v) => {
                    if (v === 'off1') {
                      handleWorkDaysChange(data.member.id, 11);
                    } else if (v === 'off2') {
                      handleWorkDaysChange(data.member.id, 12);
                    } else if (v === 'off3') {
                      handleWorkDaysChange(data.member.id, 13);
                    } else if (v === 'off4') {
                      handleWorkDaysChange(data.member.id, 14);
                    } else {
                      handleWorkDaysChange(data.member.id, parseInt(v));
                    }
                  }}
                >
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => (
                      <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                    ))}
                    <SelectItem value="off1" className="text-amber-600 font-medium">OFF 1st</SelectItem>
                    <SelectItem value="off2" className="text-amber-600 font-medium">OFF 2nd</SelectItem>
                    <SelectItem value="off3" className="text-amber-600 font-medium">OFF 3rd</SelectItem>
                    <SelectItem value="off4" className="text-amber-600 font-medium">OFF 4th</SelectItem>
                  </SelectContent>
                </Select>
                <button 
                  onClick={() => setEditingMember(null)}
                  className="text-xs text-primary hover:underline"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Current State Display */}
                <div 
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs border cursor-pointer hover:ring-2 ring-primary/50 ${
                    data.isOnOff1 || data.isOnOff2 || data.isOnOff3 || data.isOnOff4
                      ? 'bg-amber-100 text-amber-700 border-amber-300' 
                      : (SHIFT_CONFIG[data.currentShift]?.color || '')
                  }`}
                  onClick={() => editable && setEditingMember(data.member.id)}
                >
                  {data.isOnOff1 || data.isOnOff2 || data.isOnOff3 || data.isOnOff4 ? (
                    <>
                      <Calendar className="h-3 w-3" />
                      <span>{SHIFT_CONFIG[data.currentShift]?.letter}</span>
                      <span className="mx-0.5">→</span>
                      <span>{data.isOnOff1 ? 'OFF 1st' : (data.isOnOff2 ? 'OFF 2nd' : (data.isOnOff3 ? 'OFF 3rd' : 'OFF 4th'))}</span>
                    </>
                  ) : (
                    <>
                      <ShiftIcon className="h-3 w-3" />
                      <span>{SHIFT_CONFIG[data.currentShift]?.label}</span>
                      <span className="text-muted-foreground ml-1">
                        (Day {data.workDaysCompleted}/{WORK_DAYS_IN_CYCLE})
                      </span>
                    </>
                  )}
                  {editable && <Edit2 className="h-3 w-3 ml-1 opacity-50" />}
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground" />

                {/* Editable Upcoming/Next Shift */}
                {data.startsWithOff ? (
                  <div className="flex items-center gap-2">
                    {/* Show OFF badge only if there are remaining OFF days needed */}
                    {data.offDaysNeeded > 0 && (
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                        {`OFF × ${data.offDaysNeeded} →`}
                      </Badge>
                    )}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${SHIFT_CONFIG[data.nextShift]?.color || ''}`}>
                      <NextShiftIcon className="h-3 w-3" />
                      <span>{SHIFT_CONFIG[data.nextShift]?.label}</span>
                      <span className="text-muted-foreground ml-1">(Day 1)</span>
                    </div>
                  </div>
                ) : editable && isEditingNext ? (
                  <div className="flex items-center gap-2">
                    <Select 
                      value={data.nextShift} 
                      onValueChange={(v) => {
                        handleShiftChange(data.member.id, v as ShiftType);
                        handleWorkDaysChange(data.member.id, 0);
                        setEditingMember(null);
                      }}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROTATING_SHIFT_TYPES.map(s => (
                          <SelectItem key={s} value={s}>
                            {SHIFT_CONFIG[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button 
                      onClick={() => setEditingMember(null)}
                      className="text-xs text-primary hover:underline"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div 
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs border cursor-pointer hover:ring-2 ring-primary/50 ${SHIFT_CONFIG[data.nextShift]?.color || ''}`}
                    onClick={() => editable && setEditingMember(`${data.member.id}_next`)}
                  >
                    <NextShiftIcon className="h-3 w-3" />
                    <span>{SHIFT_CONFIG[data.nextShift]?.label}</span>
                    <span className="text-muted-foreground ml-1">
                      (Day {(data.workDaysCompleted || 0) + 1})
                    </span>
                    {editable && <Edit2 className="h-3 w-3 ml-1 opacity-50" />}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
            No previous data - Starting fresh with Afternoon
          </Badge>
        )}
      </div>
    );
  };

  const renderShiftDistribution = (stats: Record<WorkShiftType, number>) => (
    <div className="flex gap-2">
      {(['morning', 'afternoon', 'night', 'general'] as WorkShiftType[]).map(shift => (
        <div key={shift} className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${SHIFT_CONFIG[shift].color}`}>
          <span className="font-medium">{SHIFT_CONFIG[shift].letter}</span>
          <span>: {stats[shift]}</span>
        </div>
      ))}
      {stats.general > 0 && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${SHIFT_CONFIG.general.color}`}>
          <span className="font-medium">G</span>
          <span>: {stats.general}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Weekend Clustering Warnings */}
      {weekendClusteringWarnings.length > 0 && (
        <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Week-Off Distribution Warning</AlertTitle>
          <AlertDescription className="text-sm">
            <ul className="list-disc list-inside mt-1">
              {weekendClusteringWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" />
            Rotation Continuity for {monthName}
          </CardTitle>
          <CardDescription>
            Review last week shifts and edit continuity. Week-offs are distributed based on rotation, not fixed weekends.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Continuity Status Legend */}
          <div className="flex items-center gap-4 mb-4 p-2 bg-muted/50 rounded-lg text-xs">
            <span className="font-medium text-muted-foreground">Status:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Continuing (mid-cycle)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Transitioning (week-off → new shift)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Fresh Start (new cycle)</span>
            </div>
          </div>

          {/* Last Week Header Row */}
          <div className="flex items-center gap-3 mb-3 pb-2 border-b">
            <div className="min-w-[180px]"></div>
            <div className="flex items-center gap-0.5 shrink-0">
              {lastWeekDays.map((day) => (
                <div
                  key={format(day, 'yyyy-MM-dd')}
                  className="w-7 h-7 flex flex-col items-center justify-center text-[9px] text-muted-foreground"
                  title={format(day, 'EEEE, MMM d')}
                >
                  <span className="font-medium">{format(day, 'EEE').charAt(0)}</span>
                  <span>{format(day, 'd')}</span>
                </div>
              ))}
            </div>
            <div className="shrink-0 w-4" /> {/* Spacer for arrow */}
            <div className="text-xs text-muted-foreground font-medium">
              Next State
            </div>
          </div>

          <Tabs defaultValue="department" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="department" className="gap-2">
                <Building2 className="h-4 w-4" />
                Department View
              </TabsTrigger>
              <TabsTrigger value="location" className="gap-2">
                <MapPin className="h-4 w-4" />
                Location View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="department">
              <ScrollArea className="h-[400px]">
                <div className="space-y-6">
                  {Object.entries(departmentGroups).map(([dept, members]) => (
                    <div key={dept} className="space-y-2">
                      <div className="flex items-center justify-between sticky top-0 bg-background py-2 border-b">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{dept}</h3>
                          <Badge variant="outline">{members.length}</Badge>
                        </div>
                        {renderShiftDistribution(departmentShiftStats[dept])}
                      </div>
                      <div className="space-y-1.5 pl-2">
                        {members.map(m => renderMemberRow(m))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="location">
              <ScrollArea className="h-[400px]">
                <div className="space-y-6">
                  {Object.entries(locationGroups)
                    .filter(([_, { members }]) => members.length > 0)
                    .sort((a, b) => (b[1].location?.city || '').localeCompare(a[1].location?.city || ''))
                    .map(([locId, { location, members }]) => (
                      <div key={locId} className="space-y-2">
                        <div className="flex items-center justify-between sticky top-0 bg-background py-2 border-b">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold text-sm">
                              {location?.name || 'Unknown Location'}
                            </h3>
                            {location?.city && (
                              <span className="text-xs text-muted-foreground">({location.city})</span>
                            )}
                            <Badge variant="outline">{members.length}</Badge>
                          </div>
                          {renderShiftDistribution(locationShiftStats[locId])}
                        </div>
                        <div className="space-y-1.5 pl-2">
                          {members.map(m => renderMemberRow(m))}
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
