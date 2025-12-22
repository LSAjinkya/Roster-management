import { useState, useMemo } from 'react';
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
import { CalendarPlus, Loader2, Settings2, Eye, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TeamMember, ShiftType, Department, DEPARTMENTS } from '@/types/roster';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RosterPreviewTable } from './RosterPreviewTable';

interface SetupMonthlyRosterDialogProps {
  teamMembers: TeamMember[];
  departments: { id: string; name: string }[];
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
  workDays: number; // Number of consecutive work days (default 5)
  offDays: number; // Number of consecutive off days (default 2)
  rotationMonths: number; // Rotate week-off pattern every N months (default 3)
  startOffset: number; // Starting offset for the pattern (0-6)
}

interface PreviewAssignment {
  member_id: string;
  shift_type: ShiftType;
  date: string;
  department: Department;
}

const SHIFT_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: 'morning', label: 'Morning (07:00-16:00)' },
  { value: 'afternoon', label: 'Afternoon (13:00-22:00)' },
  { value: 'night', label: 'Night (21:00-07:00)' },
  { value: 'general', label: 'General (10:00-19:00)' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Step = 'config' | 'preview';

export function SetupMonthlyRosterDialog({ teamMembers, departments, onComplete }: SetupMonthlyRosterDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('config');
  const [previewAssignments, setPreviewAssignments] = useState<PreviewAssignment[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  
  // Week-off configuration - 5 days work + 2 days off pattern
  const [weekOffConfig, setWeekOffConfig] = useState<WeekOffConfig>({
    enabled: true,
    workDays: 5,
    offDays: 2,
    rotationMonths: 3,
    startOffset: 0,
  });

  // Filter team members by selected department
  const filteredTeamMembers = useMemo(() => {
    if (selectedDepartment === 'all') return teamMembers;
    return teamMembers.filter(m => m.department === selectedDepartment);
  }, [teamMembers, selectedDepartment]);

  // Department shift configuration - Rotation order: Afternoon → Morning → Night
  const [deptConfigs, setDeptConfigs] = useState<DepartmentShiftConfig[]>(() => 
    DEPARTMENTS.map(dept => ({
      department: dept,
      defaultShift: dept === 'HR' || dept === 'Vendor Coordinator' ? 'general' : 'afternoon',
      rotateShifts: dept !== 'HR' && dept !== 'Vendor Coordinator',
      availableShifts: dept === 'HR' || dept === 'Vendor Coordinator' 
        ? ['general'] 
        : ['afternoon', 'morning', 'night'], // Order: A → M → N
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

  // Fetch public holidays for the month
  useMemo(() => {
    const fetchHolidays = async () => {
      const { data } = await supabase
        .from('public_holidays')
        .select('date')
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));
      
      if (data) {
        setPublicHolidays(data.map(h => h.date));
      }
    };
    if (open) fetchHolidays();
  }, [open, monthStart, monthEnd]);

  // Calculate if a date is a week-off based on 5-work + 2-off pattern
  const isWeekOff = (dayIndex: number, memberIndex: number): boolean => {
    if (!weekOffConfig.enabled) return false;
    
    const cycleLength = weekOffConfig.workDays + weekOffConfig.offDays; // 7 days cycle
    const memberOffset = (memberIndex * weekOffConfig.offDays) % cycleLength;
    const adjustedDayIndex = (dayIndex + weekOffConfig.startOffset + memberOffset) % cycleLength;
    
    // Off days are at the end of each cycle
    return adjustedDayIndex >= weekOffConfig.workDays;
  };

  const generateAssignments = (): PreviewAssignment[] => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const assignments: PreviewAssignment[] = [];

    const membersByDept: Record<string, TeamMember[]> = {};
    filteredTeamMembers.forEach(member => {
      if (!membersByDept[member.department]) {
        membersByDept[member.department] = [];
      }
      membersByDept[member.department].push(member);
    });

    days.forEach((day, dayIndex) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isPublicHoliday = publicHolidays.includes(dateStr);

      Object.entries(membersByDept).forEach(([dept, members]) => {
        if (members.length === 0) return;

        const config = deptConfigs.find(c => c.department === dept);
        if (!config) return;

        members.forEach((member, memberIndex) => {
          // Check for public holiday first
          if (isPublicHoliday) {
            assignments.push({
              member_id: member.id,
              shift_type: 'public-off',
              date: dateStr,
              department: member.department as Department,
            });
            return;
          }

          // Check for week-off (5 work + 2 off pattern)
          if (isWeekOff(dayIndex, memberIndex)) {
            assignments.push({
              member_id: member.id,
              shift_type: 'week-off',
              date: dateStr,
              department: member.department as Department,
            });
            return;
          }

          // Assign regular shift
          let shiftType: ShiftType;
          
          if (config.rotateShifts && config.availableShifts.length > 1) {
            const shiftIndex = (dayIndex + memberIndex) % config.availableShifts.length;
            shiftType = config.availableShifts[shiftIndex];
          } else {
            shiftType = config.defaultShift;
          }

          assignments.push({
            member_id: member.id,
            shift_type: shiftType,
            date: dateStr,
            department: member.department as Department,
          });
        });
      });
    });

    return assignments;
  };

  const handleGeneratePreview = () => {
    const assignments = generateAssignments();
    setPreviewAssignments(assignments);
    setStep('preview');
  };

  const handleEditPreviewCell = (memberId: string, date: string, currentShift: ShiftType | null) => {
    // Cycle through shifts: M -> A -> N -> CO -> off -> M
    const shiftCycle: (ShiftType | null)[] = ['morning', 'afternoon', 'night', 'comp-off', null];
    const currentIndex = shiftCycle.indexOf(currentShift);
    const nextIndex = (currentIndex + 1) % shiftCycle.length;
    const nextShift = shiftCycle[nextIndex];
    
    setPreviewAssignments(prev => {
      // Remove existing assignment for this cell
      const filtered = prev.filter(a => !(a.member_id === memberId && a.date === date));
      
      // Add new assignment if not null
      if (nextShift) {
        const member = teamMembers.find(m => m.id === memberId);
        if (member) {
          filtered.push({
            member_id: memberId,
            shift_type: nextShift,
            date: date,
            department: member.department as Department,
          });
        }
      }
      
      return filtered;
    });
  };

  const handleSaveRoster = async () => {
    setLoading(true);
    
    try {
      // Delete existing assignments for next month
      const { error: deleteError } = await supabase
        .from('shift_assignments')
        .delete()
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      if (deleteError) throw deleteError;

      // Insert new assignments in batches
      const batchSize = 100;
      for (let i = 0; i < previewAssignments.length; i += batchSize) {
        const batch = previewAssignments.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('shift_assignments')
          .insert(batch);

        if (insertError) throw insertError;
      }

      const weekOffsCount = previewAssignments.filter(a => a.shift_type === 'comp-off').length;
      
      toast.success(`Monthly roster for ${monthName} saved!`, {
        description: `${previewAssignments.length} assignments (${weekOffsCount} week-offs).`,
      });
      
      setOpen(false);
      setStep('config');
      onComplete?.();
    } catch (error) {
      console.error('Error saving roster:', error);
      toast.error('Failed to save roster', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setStep('config');
      setPreviewAssignments([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <CalendarPlus size={16} />
          Setup {format(nextMonth, 'MMM')} Roster
        </Button>
      </DialogTrigger>
      <DialogContent className={step === 'preview' ? "max-w-[95vw] max-h-[95vh]" : "max-w-2xl max-h-[90vh]"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'config' ? <Settings2 size={20} /> : <Eye size={20} />}
            {step === 'config' ? 'Setup Monthly Roster' : 'Preview & Edit Roster'}
          </DialogTitle>
          <DialogDescription>
            {step === 'config' 
              ? `Configure shift assignments for ${monthName}`
              : `Review and edit shifts before saving. Click any cell to change shift.`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'config' ? (
          <>
            {/* Department Selector */}
            <div className="rounded-lg border p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Select Department</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose which department to set up roster for
                  </p>
                </div>
                <Select
                  value={selectedDepartment}
                  onValueChange={setSelectedDepartment}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedDepartment !== 'all' && (
                <p className="text-sm text-primary mt-2">
                  Roster will be generated for {filteredTeamMembers.length} member(s) in {selectedDepartment}
                </p>
              )}
            </div>

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
                        5 days work + 2 consecutive days off pattern
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
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Work Days (Consecutive)</Label>
                          <Select
                            value={String(weekOffConfig.workDays)}
                            onValueChange={(v) => 
                              setWeekOffConfig(prev => ({ ...prev, workDays: Number(v) }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="4">4 days</SelectItem>
                              <SelectItem value="5">5 days</SelectItem>
                              <SelectItem value="6">6 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Off Days (Consecutive)</Label>
                          <Select
                            value={String(weekOffConfig.offDays)}
                            onValueChange={(v) => 
                              setWeekOffConfig(prev => ({ ...prev, offDays: Number(v) }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 day</SelectItem>
                              <SelectItem value="2">2 days</SelectItem>
                              <SelectItem value="3">3 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Rotation Period</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Week-off days shift after this many months
                        </p>
                        <Select
                          value={String(weekOffConfig.rotationMonths)}
                          onValueChange={(v) => 
                            setWeekOffConfig(prev => ({ ...prev, rotationMonths: Number(v) }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Every month</SelectItem>
                            <SelectItem value="2">Every 2 months</SelectItem>
                            <SelectItem value="3">Every 3 months</SelectItem>
                            <SelectItem value="6">Every 6 months</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Starting Day Offset</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Adjust when the first week-off occurs in the cycle
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {[0, 1, 2, 3, 4, 5, 6].map((offset) => (
                            <Button
                              key={offset}
                              variant={weekOffConfig.startOffset === offset ? "default" : "outline"}
                              size="sm"
                              onClick={() => setWeekOffConfig(prev => ({ ...prev, startOffset: offset }))}
                            >
                              Day {offset + 1}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-sm font-medium mb-1">Pattern Preview</p>
                        <div className="flex gap-1 flex-wrap">
                          {Array.from({ length: weekOffConfig.workDays + weekOffConfig.offDays }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${
                                i < weekOffConfig.workDays 
                                  ? 'bg-primary/20 text-primary' 
                                  : 'bg-gray-300 text-gray-700'
                              }`}
                            >
                              {i < weekOffConfig.workDays ? 'W' : 'OFF'}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Cycle: {weekOffConfig.workDays} work + {weekOffConfig.offDays} off = {weekOffConfig.workDays + weekOffConfig.offDays} days
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <Label className="text-base">Leave Types Legend</Label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-medium">OFF</div>
                      <span>Weekly Off</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-6 rounded bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">PO</div>
                      <span>Public Holiday</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-6 rounded bg-orange-100 flex items-center justify-center text-xs font-medium text-orange-700">CO</div>
                      <span>Comp Off</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-6 rounded bg-green-100 flex items-center justify-center text-xs font-medium text-green-700">PL</div>
                      <span>Paid Leave</span>
                    </div>
                  </div>
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
                    <span className="text-muted-foreground">Department:</span>
                    <span>{selectedDepartment === 'all' ? 'All Departments' : selectedDepartment}</span>
                    <span className="text-muted-foreground">Team Members:</span>
                    <span>{filteredTeamMembers.length}</span>
                    <span className="text-muted-foreground">Week-Offs:</span>
                    <span>
                      {weekOffConfig.enabled 
                        ? `${weekOffConfig.workDays} work + ${weekOffConfig.offDays} off (rotate every ${weekOffConfig.rotationMonths} months)`
                        : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-3">Department Shifts</h4>
                  <div className="space-y-1 text-sm">
                    {deptConfigs.filter(c => 
                      filteredTeamMembers.some(m => m.department === c.department)
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
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGeneratePreview} className="gap-2">
                <Eye size={16} />
                Preview Roster
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <ScrollArea className="h-[60vh]">
              <RosterPreviewTable
                assignments={previewAssignments}
                teamMembers={filteredTeamMembers}
                month={nextMonth}
                editable={true}
                onEditCell={handleEditPreviewCell}
              />
            </ScrollArea>

            <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
              <span>
                {previewAssignments.length} assignments • 
                {previewAssignments.filter(a => a.shift_type === 'comp-off').length} week-offs
              </span>
              <span>Click any cell to cycle through shifts</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('config')} className="gap-2">
                <ChevronLeft size={16} />
                Back to Config
              </Button>
              <Button onClick={handleSaveRoster} disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Roster
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
