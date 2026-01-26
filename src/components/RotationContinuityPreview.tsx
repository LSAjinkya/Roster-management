import { useMemo, useState, useEffect } from 'react';
import { format, addMonths, startOfMonth } from 'date-fns';
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

const SHIFT_CONFIG: Record<string, { icon: typeof Sun; color: string; label: string; letter: string }> = {
  morning: { icon: Sunrise, color: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Morning', letter: 'M' },
  afternoon: { icon: Sun, color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Afternoon', letter: 'A' },
  night: { icon: Moon, color: 'bg-purple-100 text-purple-700 border-purple-300', label: 'Night', letter: 'N' },
  general: { icon: Calendar, color: 'bg-gray-100 text-gray-700 border-gray-300', label: 'General', letter: 'G' },
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
  const [localOverrides, setLocalOverrides] = useState<Record<string, { shift: ShiftType; workDays: number }>>({});

  const nextMonth = addMonths(new Date(), 1);
  const monthName = format(nextMonth, 'MMMM yyyy');

  // Fetch work locations
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase
        .from('work_locations')
        .select('id, name, code, city')
        .eq('is_active', true)
        .order('name');
      if (data) setWorkLocations(data);
    };
    fetchLocations();
  }, []);

  // Calculate continuation for each member with local overrides
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
        };
      }

      const currentShift = override?.shift || prevState?.shift || 'afternoon';
      const workDaysCompleted = override?.workDays ?? prevState?.workDaysInCurrent ?? 0;
      const workDaysRemaining = WORK_DAYS_IN_CYCLE - workDaysCompleted;
      
      // If they've completed 5+ work days, they need OFF days next
      const needsOff = workDaysCompleted >= WORK_DAYS_IN_CYCLE;
      const offDaysNeeded = needsOff ? (member.weekOffEntitlement || 2) - (prevState?.offDaysUsed || 0) : 0;
      
      // Calculate next shift after OFF
      const currentShiftIndex = SHIFT_ROTATION_ORDER.indexOf(currentShift as any);
      const nextShiftAfterOff = needsOff 
        ? SHIFT_ROTATION_ORDER[(currentShiftIndex + 1) % 3]
        : currentShift;

      return {
        member,
        hasPreviousData: true,
        currentShift,
        workDaysCompleted,
        workDaysRemaining: needsOff ? 0 : workDaysRemaining,
        nextShift: nextShiftAfterOff,
        startsWithOff: needsOff && offDaysNeeded > 0,
        offDaysNeeded: Math.max(0, offDaysNeeded),
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

  const renderMemberRow = (data: typeof continuityData[0], editable = true) => {
    const ShiftIcon = SHIFT_CONFIG[data.currentShift]?.icon || Sun;
    const NextShiftIcon = SHIFT_CONFIG[data.nextShift]?.icon || Sun;
    const isEditing = editingMember === data.member.id;
    const isEditingNext = editingMember === `${data.member.id}_next`;
    
    // Determine continuity status for visual indicator
    const isContinuing = data.hasPreviousData && data.workDaysCompleted > 0;
    const isStartingFresh = !data.hasPreviousData || data.workDaysCompleted === 0;
    const isTransitioning = data.startsWithOff;
    
    return (
      <div
        key={data.member.id}
        className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-[200px]">
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
          <div className="w-32 truncate font-medium text-sm">
            {data.member.name}
          </div>
          <Badge variant="outline" className="text-xs">
            {data.member.role}
          </Badge>
          {/* Status Badge */}
          {isContinuing && !isTransitioning && (
            <Badge variant="secondary" className="text-[10px] h-5 bg-blue-100 text-blue-700 border-blue-200">
              Continuing
            </Badge>
          )}
          {isTransitioning && (
            <Badge variant="secondary" className="text-[10px] h-5 bg-amber-100 text-amber-700 border-amber-200">
              Transitioning
            </Badge>
          )}
          {isStartingFresh && !isTransitioning && (
            <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-100 text-emerald-700 border-emerald-200">
              Fresh Start
            </Badge>
          )}
        </div>

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
                  value={data.workDaysCompleted >= WORK_DAYS_IN_CYCLE ? 'off1' : String(data.workDaysCompleted)} 
                  onValueChange={(v) => {
                    if (v === 'off1' || v === 'off2') {
                      // Set to 5+ to trigger OFF days
                      handleWorkDaysChange(data.member.id, WORK_DAYS_IN_CYCLE);
                    } else {
                      handleWorkDaysChange(data.member.id, parseInt(v));
                    }
                  }}
                >
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(d => (
                      <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                    ))}
                    <SelectItem value="off1" className="text-amber-600 font-medium">
                      OFF 1st
                    </SelectItem>
                    <SelectItem value="off2" className="text-amber-600 font-medium">
                      OFF 2nd
                    </SelectItem>
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
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs border cursor-pointer hover:ring-2 ring-primary/50 ${SHIFT_CONFIG[data.currentShift]?.color || ''}`}
                  onClick={() => editable && setEditingMember(data.member.id)}
                >
                  <ShiftIcon className="h-3 w-3" />
                  <span>{SHIFT_CONFIG[data.currentShift]?.label}</span>
                  <span className="text-muted-foreground ml-1">
                    (Day {data.workDaysCompleted}/{WORK_DAYS_IN_CYCLE})
                  </span>
                  {editable && <Edit2 className="h-3 w-3 ml-1 opacity-50" />}
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground" />

                {/* Editable Upcoming/Next Shift */}
                {data.startsWithOff ? (
                  <Badge variant="secondary" className="text-xs bg-gray-200">
                    OFF × {data.offDaysNeeded}
                  </Badge>
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
            Click on any shift to edit. Week-offs are distributed based on rotation, not fixed weekends.
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
