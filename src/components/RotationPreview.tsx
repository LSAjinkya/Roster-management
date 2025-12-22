import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Eye, RefreshCw, Play, Users, Calendar } from 'lucide-react';
import { TeamMember, Department, Role, ShiftType } from '@/types/roster';
import { MemberRotationState, getMemberShiftTypeForDate, getWeekOffDaysInCycle, RotationConfig, ROTATING_DEPARTMENTS } from '@/types/shiftRules';
import { cn } from '@/lib/utils';

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
};

const SHIFT_LABELS: Record<string, string> = {
  'morning': 'M',
  'afternoon': 'A',
  'night': 'N',
  'general': 'G',
  'week-off': 'OFF',
  'public-off': 'PH',
  'paid-leave': 'PL',
};

export function RotationPreview({ teamMembers }: RotationPreviewProps) {
  const [rotationStates, setRotationStates] = useState<MemberRotationState[]>([]);
  const [rotationConfig, setRotationConfig] = useState<RotationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [previewMonth, setPreviewMonth] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statesRes, configRes] = await Promise.all([
        supabase.from('member_rotation_state').select('*'),
        supabase.from('rotation_config').select('*').eq('is_active', true).maybeSingle()
      ]);

      if (statesRes.error) throw statesRes.error;
      if (configRes.error) throw configRes.error;

      setRotationStates(statesRes.data || []);
      
      // Handle shift_sequence type
      if (configRes.data) {
        const config = configRes.data as any;
        setRotationConfig({
          ...config,
          shift_sequence: config.shift_sequence || ['afternoon', 'morning', 'night']
        });
      }
    } catch (error) {
      console.error('Error fetching rotation data:', error);
      toast.error('Failed to load rotation data');
    } finally {
      setLoading(false);
    }
  };

  const rotatingMembers = useMemo(() => 
    teamMembers.filter(m => 
      ROTATING_DEPARTMENTS.includes(m.department) && m.role !== 'TL'
    ), [teamMembers]
  );

  const uninitializedMembers = useMemo(() => {
    const initializedIds = new Set(rotationStates.map(s => s.member_id));
    return rotatingMembers.filter(m => !initializedIds.has(m.id));
  }, [rotatingMembers, rotationStates]);

  const handleInitializeAll = async () => {
    if (!rotationConfig) {
      toast.error('No rotation config found');
      return;
    }

    setInitializing(true);
    try {
      const shiftSequence = rotationConfig.shift_sequence || ['afternoon', 'morning', 'night'];
      const today = new Date();
      const cycleStartDate = startOfMonth(today);

      // Create rotation states for uninitialized members
      // Stagger starting shifts across the sequence
      const newStates = uninitializedMembers.map((member, index) => ({
        member_id: member.id,
        current_shift_type: shiftSequence[index % shiftSequence.length],
        cycle_start_date: format(cycleStartDate, 'yyyy-MM-dd'),
      }));

      if (newStates.length === 0) {
        toast.info('All members already initialized');
        return;
      }

      const { error } = await supabase
        .from('member_rotation_state')
        .insert(newStates);

      if (error) throw error;

      toast.success(`Initialized ${newStates.length} member(s)`, {
        description: 'Members have been assigned starting shifts'
      });
      
      fetchData();
    } catch (error) {
      console.error('Error initializing members:', error);
      toast.error('Failed to initialize members');
    } finally {
      setInitializing(false);
    }
  };

  // Generate preview for the selected month
  const previewData = useMemo(() => {
    if (!rotationConfig || rotationStates.length === 0) return [];

    const monthStart = startOfMonth(previewMonth);
    const monthEnd = endOfMonth(previewMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const shiftSequence = rotationConfig.shift_sequence || ['afternoon', 'morning', 'night'];

    return rotatingMembers.map((member, memberIndex) => {
      const state = rotationStates.find(s => s.member_id === member.id);
      const cycleStartDate = state 
        ? new Date(state.cycle_start_date) 
        : monthStart;
      const currentShiftType = state?.current_shift_type || shiftSequence[0];

      const memberOffset = memberIndex % 7;

      const shifts = days.map(day => {
        const shiftType = getMemberShiftTypeForDate(
          cycleStartDate,
          day,
          currentShiftType,
          rotationConfig.rotation_cycle_days,
          shiftSequence
        );

        // Check for week-off
        const daysSinceCycleStart = Math.floor(
          (day.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const dayInCycle = ((daysSinceCycleStart % rotationConfig.rotation_cycle_days) + rotationConfig.rotation_cycle_days) % rotationConfig.rotation_cycle_days;
        
        const weekOffDays = getWeekOffDaysInCycle(
          cycleStartDate,
          memberOffset,
          rotationConfig.rotation_cycle_days
        );

        const isWeekOff = weekOffDays.includes(dayInCycle);

        return {
          date: format(day, 'yyyy-MM-dd'),
          dayNum: format(day, 'd'),
          dayName: format(day, 'EEE'),
          shiftType: isWeekOff ? 'week-off' : shiftType,
        };
      });

      return {
        member,
        shifts,
        currentCycleShift: currentShiftType,
      };
    });
  }, [previewMonth, rotationStates, rotationConfig, rotatingMembers]);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading rotation data...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye size={20} />
              15-Day Rotation Preview
            </CardTitle>
            <CardDescription>
              Preview how shifts are assigned based on rotation rules
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={format(previewMonth, 'yyyy-MM')}
              onValueChange={(v) => setPreviewMonth(new Date(v + '-01'))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[-1, 0, 1, 2].map(offset => {
                  const month = addDays(startOfMonth(new Date()), offset * 30);
                  return (
                    <SelectItem key={offset} value={format(month, 'yyyy-MM')}>
                      {format(month, 'MMMM yyyy')}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Initialization Status */}
        {uninitializedMembers.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="text-amber-600" size={20} />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    {uninitializedMembers.length} member(s) not initialized
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    These members need rotation states before auto-assignment works
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleInitializeAll} 
                disabled={initializing}
                className="gap-2"
              >
                <Play size={14} />
                {initializing ? 'Initializing...' : 'Initialize All'}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {uninitializedMembers.slice(0, 10).map(m => (
                <Badge key={m.id} variant="outline" className="text-xs">
                  {m.name}
                </Badge>
              ))}
              {uninitializedMembers.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{uninitializedMembers.length - 10} more
                </Badge>
              )}
            </div>
          </div>
        )}

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
                      Cycle
                    </th>
                    {previewData[0]?.shifts.map(s => (
                      <th key={s.date} className="p-1 text-center min-w-[28px]">
                        <div className="text-muted-foreground text-[10px]">{s.dayName.charAt(0)}</div>
                        <div className="font-semibold">{s.dayNum}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map(({ member, shifts, currentCycleShift }) => (
                    <tr key={member.id} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="sticky left-0 z-10 bg-card p-2 font-medium truncate">
                        <div>{member.name}</div>
                        <div className="text-[10px] text-muted-foreground">{member.department}</div>
                      </td>
                      <td className="p-1">
                        <Badge className={cn("text-[10px]", SHIFT_COLORS[currentCycleShift])}>
                          {currentCycleShift.charAt(0).toUpperCase()}
                        </Badge>
                      </td>
                      {shifts.map(s => (
                        <td key={s.date} className="p-0.5 text-center">
                          <span className={cn(
                            "inline-flex items-center justify-center w-5 h-4 rounded text-[9px] font-bold",
                            SHIFT_COLORS[s.shiftType] || 'bg-muted text-muted-foreground'
                          )}>
                            {SHIFT_LABELS[s.shiftType] || '-'}
                          </span>
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
            <p>No rotation data to preview</p>
            <p className="text-sm">Initialize members to see the rotation pattern</p>
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

        {/* Summary */}
        {rotationConfig && (
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <h4 className="font-medium mb-2">Current Configuration</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-muted-foreground">Cycle Length:</span>
                <span className="ml-2 font-medium">{rotationConfig.rotation_cycle_days} days</span>
              </div>
              <div>
                <span className="text-muted-foreground">Sequence:</span>
                <span className="ml-2 font-medium">
                  {(rotationConfig.shift_sequence || []).map(s => s.charAt(0).toUpperCase()).join(' → ')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Initialized:</span>
                <span className="ml-2 font-medium">{rotationStates.length}/{rotatingMembers.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Weekly Offs:</span>
                <span className="ml-2 font-medium">2+2 pattern</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}