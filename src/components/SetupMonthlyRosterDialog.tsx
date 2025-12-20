import { useState } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, getWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarPlus, Loader2, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TeamMember, ShiftType, Department, DEPARTMENTS } from '@/types/roster';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SetupMonthlyRosterDialogProps {
  teamMembers: TeamMember[];
  onComplete?: () => void;
}

interface DepartmentShiftConfig {
  department: Department;
  defaultShift: ShiftType;
  rotateShifts: boolean;
  availableShifts: ShiftType[];
}

interface WeekOffConfig {
  enabled: boolean;
  daysPerWeek: 1 | 2;
  rotatingDays: boolean;
  fixedDays: number[]; // 0-6 for Sun-Sat
}

const SHIFT_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: 'morning', label: 'Morning (07:00-16:00)' },
  { value: 'afternoon', label: 'Afternoon (13:00-22:00)' },
  { value: 'night', label: 'Night (21:00-07:00)' },
  { value: 'general', label: 'General (10:00-19:00)' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SetupMonthlyRosterDialog({ teamMembers, onComplete }: SetupMonthlyRosterDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Week-off configuration
  const [weekOffConfig, setWeekOffConfig] = useState<WeekOffConfig>({
    enabled: true,
    daysPerWeek: 1,
    rotatingDays: true,
    fixedDays: [0], // Sunday by default
  });

  // Department shift configuration
  const [deptConfigs, setDeptConfigs] = useState<DepartmentShiftConfig[]>(() => 
    DEPARTMENTS.map(dept => ({
      department: dept,
      defaultShift: dept === 'HR' || dept === 'Vendor Coordinator' ? 'general' : 'morning',
      rotateShifts: dept !== 'HR' && dept !== 'Vendor Coordinator',
      availableShifts: dept === 'HR' || dept === 'Vendor Coordinator' 
        ? ['general'] 
        : ['morning', 'afternoon', 'night'],
    }))
  );

  const nextMonth = addMonths(new Date(), 1);
  const monthStart = startOfMonth(nextMonth);
  const monthEnd = endOfMonth(nextMonth);
  const monthName = format(nextMonth, 'MMMM yyyy');
  const totalDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;

  const updateDeptConfig = (dept: Department, updates: Partial<DepartmentShiftConfig>) => {
    setDeptConfigs(prev => 
      prev.map(config => 
        config.department === dept ? { ...config, ...updates } : config
      )
    );
  };

  const toggleWeekOffDay = (day: number) => {
    setWeekOffConfig(prev => {
      const newDays = prev.fixedDays.includes(day)
        ? prev.fixedDays.filter(d => d !== day)
        : [...prev.fixedDays, day].slice(0, prev.daysPerWeek);
      return { ...prev, fixedDays: newDays };
    });
  };

  const generateMonthlyRoster = async () => {
    setLoading(true);
    
    try {
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
      const assignments: {
        member_id: string;
        shift_type: ShiftType;
        date: string;
        department: Department;
      }[] = [];

      // Group members by department
      const membersByDept: Record<string, TeamMember[]> = {};
      teamMembers.forEach(member => {
        if (!membersByDept[member.department]) {
          membersByDept[member.department] = [];
        }
        membersByDept[member.department].push(member);
      });

      // Track week-offs per member
      const memberWeekOffs: Record<string, Set<string>> = {};
      teamMembers.forEach(m => {
        memberWeekOffs[m.id] = new Set();
      });

      days.forEach((day, dayIndex) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day);
        const weekNumber = getWeek(day);

        Object.entries(membersByDept).forEach(([dept, members]) => {
          if (members.length === 0) return;

          const config = deptConfigs.find(c => c.department === dept);
          if (!config) return;

          members.forEach((member, memberIndex) => {
            // Check if this should be a week-off day
            let isWeekOff = false;
            
            if (weekOffConfig.enabled) {
              if (weekOffConfig.rotatingDays) {
                // Rotating week-offs: each member gets different days based on their index
                const offDayOffset = (weekNumber + memberIndex) % 7;
                const offDays: number[] = [];
                for (let i = 0; i < weekOffConfig.daysPerWeek; i++) {
                  offDays.push((offDayOffset + i * 3) % 7); // Spread out off days
                }
                isWeekOff = offDays.includes(dayOfWeek);
              } else {
                // Fixed days off
                isWeekOff = weekOffConfig.fixedDays.includes(dayOfWeek);
              }
            }

            if (isWeekOff) {
              memberWeekOffs[member.id].add(dateStr);
              assignments.push({
                member_id: member.id,
                shift_type: 'comp-off',
                date: dateStr,
                department: member.department as Department,
              });
            } else {
              // Determine shift type
              let shiftType: ShiftType;
              
              if (config.rotateShifts && config.availableShifts.length > 1) {
                // Rotate through available shifts
                const shiftIndex = (dayIndex + memberIndex) % config.availableShifts.length;
                shiftType = config.availableShifts[shiftIndex];
              } else {
                shiftType = config.defaultShift;
              }

              // Skip weekends for General shift (HR, TLs, etc.)
              if (shiftType === 'general' && (dayOfWeek === 0 || dayOfWeek === 6)) {
                return;
              }

              assignments.push({
                member_id: member.id,
                shift_type: shiftType,
                date: dateStr,
                department: member.department as Department,
              });
            }
          });
        });
      });

      // Delete existing assignments for next month
      const { error: deleteError } = await supabase
        .from('shift_assignments')
        .delete()
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      if (deleteError) throw deleteError;

      // Insert new assignments in batches
      const batchSize = 100;
      for (let i = 0; i < assignments.length; i += batchSize) {
        const batch = assignments.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('shift_assignments')
          .insert(batch);

        if (insertError) throw insertError;
      }

      const weekOffsCount = Object.values(memberWeekOffs).reduce((sum, set) => sum + set.size, 0);
      
      toast.success(`Monthly roster for ${monthName} created successfully!`, {
        description: `${assignments.length} assignments generated (${weekOffsCount} week-offs).`,
      });
      
      setOpen(false);
      onComplete?.();
    } catch (error) {
      console.error('Error generating roster:', error);
      toast.error('Failed to generate roster', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <CalendarPlus size={16} />
          Setup {format(nextMonth, 'MMM')} Roster
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 size={20} />
            Setup Monthly Roster
          </DialogTitle>
          <DialogDescription>
            Configure shift assignments for <strong>{monthName}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="weekoff" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="weekoff">Week-Off Rules</TabsTrigger>
            <TabsTrigger value="shifts">Department Shifts</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="weekoff" className="space-y-4 mt-4">
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Enable Week-Offs</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically assign weekly offs to team members
                  </p>
                </div>
                <Switch
                  checked={weekOffConfig.enabled}
                  onCheckedChange={(enabled) => 
                    setWeekOffConfig(prev => ({ ...prev, enabled }))
                  }
                />
              </div>

              {weekOffConfig.enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Days Off Per Week</Label>
                    <Select
                      value={String(weekOffConfig.daysPerWeek)}
                      onValueChange={(v) => 
                        setWeekOffConfig(prev => ({ 
                          ...prev, 
                          daysPerWeek: Number(v) as 1 | 2,
                          fixedDays: prev.fixedDays.slice(0, Number(v))
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 day per week</SelectItem>
                        <SelectItem value="2">2 days per week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Rotating Week-Offs</Label>
                      <p className="text-sm text-muted-foreground">
                        Different members get different days off
                      </p>
                    </div>
                    <Switch
                      checked={weekOffConfig.rotatingDays}
                      onCheckedChange={(rotatingDays) => 
                        setWeekOffConfig(prev => ({ ...prev, rotatingDays }))
                      }
                    />
                  </div>

                  {!weekOffConfig.rotatingDays && (
                    <div className="space-y-2">
                      <Label>Fixed Off Days</Label>
                      <div className="flex gap-2 flex-wrap">
                        {DAY_NAMES.map((day, index) => (
                          <Button
                            key={day}
                            variant={weekOffConfig.fixedDays.includes(index) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleWeekOffDay(index)}
                            disabled={
                              !weekOffConfig.fixedDays.includes(index) && 
                              weekOffConfig.fixedDays.length >= weekOffConfig.daysPerWeek
                            }
                          >
                            {day}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="shifts" className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {deptConfigs.map((config) => {
                  const memberCount = teamMembers.filter(m => m.department === config.department).length;
                  if (memberCount === 0) return null;
                  
                  return (
                    <div key={config.department} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{config.department}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({memberCount} members)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Rotate</Label>
                          <Switch
                            checked={config.rotateShifts}
                            onCheckedChange={(rotate) => 
                              updateDeptConfig(config.department, { rotateShifts: rotate })
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Default Shift</Label>
                          <Select
                            value={config.defaultShift}
                            onValueChange={(v) => 
                              updateDeptConfig(config.department, { defaultShift: v as ShiftType })
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SHIFT_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {config.rotateShifts && (
                          <div className="space-y-1">
                            <Label className="text-xs">Rotate Through</Label>
                            <div className="flex gap-1 flex-wrap">
                              {(['morning', 'afternoon', 'night'] as ShiftType[]).map(shift => (
                                <Button
                                  key={shift}
                                  variant={config.availableShifts.includes(shift) ? "default" : "outline"}
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    const newShifts = config.availableShifts.includes(shift)
                                      ? config.availableShifts.filter(s => s !== shift)
                                      : [...config.availableShifts, shift];
                                    if (newShifts.length > 0) {
                                      updateDeptConfig(config.department, { availableShifts: newShifts });
                                    }
                                  }}
                                >
                                  {shift.charAt(0).toUpperCase() + shift.slice(1, 3)}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="summary" className="mt-4 space-y-4">
            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="font-medium mb-3">Configuration Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Month:</span>
                <span>{monthName}</span>
                <span className="text-muted-foreground">Total Days:</span>
                <span>{totalDays}</span>
                <span className="text-muted-foreground">Team Members:</span>
                <span>{teamMembers.length}</span>
                <span className="text-muted-foreground">Week-Offs:</span>
                <span>
                  {weekOffConfig.enabled 
                    ? `${weekOffConfig.daysPerWeek} day(s)/week (${weekOffConfig.rotatingDays ? 'rotating' : 'fixed'})`
                    : 'Disabled'}
                </span>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-3">Department Shifts</h4>
              <div className="space-y-1 text-sm">
                {deptConfigs.filter(c => 
                  teamMembers.some(m => m.department === c.department)
                ).map(config => (
                  <div key={config.department} className="flex justify-between">
                    <span className="text-muted-foreground">{config.department}:</span>
                    <span>
                      {config.rotateShifts 
                        ? config.availableShifts.map(s => s.charAt(0).toUpperCase()).join('/')
                        : config.defaultShift.charAt(0).toUpperCase() + config.defaultShift.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={generateMonthlyRoster} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Roster'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
