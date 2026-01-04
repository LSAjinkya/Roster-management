import { useState, useMemo, useEffect } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, getWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarPlus, Loader2, Settings2, Eye, Save, ChevronLeft, ChevronRight, AlertTriangle, FileCheck, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TeamMember, ShiftType, Department, DEPARTMENTS, TeamGroup } from '@/types/roster';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RosterPreviewTable } from './RosterPreviewTable';
import { RotationContinuityPreview } from './RotationContinuityPreview';
import { MemberRotationState, RotationConfig, getWeekOffDaysInCycle, getMemberShiftForDate, ROTATING_DEPARTMENTS, GENERAL_SHIFT_DEPARTMENTS, WORK_DAYS_IN_CYCLE, OFF_DAYS_IN_CYCLE, CYCLE_LENGTH, SHIFT_STABILITY_WORK_DAYS, SHIFT_ROTATION_ORDER, REST_DAYS_BEFORE_NIGHT, isOffDay, requiresRestBeforeNight } from '@/types/shiftRules';
import { validateRoster, autoFixRosterViolations } from '@/utils/rosterValidation';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useInfraTeamSettings, isRoleEligibleForShift } from '@/hooks/useInfraTeamSettings';

interface SetupMonthlyRosterDialogProps {
  teamMembers: TeamMember[];
  departments: {
    id: string;
    name: string;
  }[];
  onComplete?: () => void;
}

// Department configuration from database
interface DepartmentRosterConfig {
  id: string;
  name: string;
  work_days_per_cycle: number;
  off_days_per_cycle: number;
  rotation_enabled: boolean;
}

interface DepartmentShiftConfig {
  department: Department;
  defaultShift: ShiftType;
  rotateShifts: boolean;
  availableShifts: ShiftType[];
  workDaysPerCycle: number;
  offDaysPerCycle: number;
}
interface PreviewAssignment {
  member_id: string;
  shift_type: ShiftType;
  date: string;
  department: Department;
}
const SHIFT_OPTIONS: {
  value: ShiftType;
  label: string;
}[] = [{
  value: 'morning',
  label: 'Morning (07:00-16:00)'
}, {
  value: 'afternoon',
  label: 'Afternoon (13:00-22:00)'
}, {
  value: 'night',
  label: 'Night (21:00-07:00)'
}, {
  value: 'general',
  label: 'General (10:00-19:00)'
}];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type Step = 'config' | 'continuity' | 'preview';
type RosterSaveStatus = 'draft' | 'published';
export function SetupMonthlyRosterDialog({
  teamMembers,
  departments,
  onComplete
}: SetupMonthlyRosterDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('config');
  const [previewAssignments, setPreviewAssignments] = useState<PreviewAssignment[]>([]);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    violations: any[];
    warnings: any[];
  } | null>(null);
  const [publicHolidays, setPublicHolidays] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // 15-day rotation data
  const [rotationConfig, setRotationConfig] = useState<RotationConfig | null>(null);
  const [rotationStates, setRotationStates] = useState<MemberRotationState[]>([]);
  const [loadingRotation, setLoadingRotation] = useState(false);
  const [use15DayRotation, setUse15DayRotation] = useState(true);
  
  // Department roster configs from database
  const [departmentRosterConfigs, setDepartmentRosterConfigs] = useState<DepartmentRosterConfig[]>([]);

  // Infra team settings from the hook
  const infraSettings = useInfraTeamSettings();

  // Filter team members by selected departments
  const filteredTeamMembers = useMemo(() => {
    if (selectedDepartments.length === 0) return teamMembers;
    return teamMembers.filter(m => selectedDepartments.includes(m.department));
  }, [teamMembers, selectedDepartments]);

  // Department shift configuration - Rotation order: Afternoon → Morning → Night
  // Now includes work_days_per_cycle and off_days_per_cycle from DB
  const [deptConfigs, setDeptConfigs] = useState<DepartmentShiftConfig[]>([]);
  
  // Initialize dept configs when departmentRosterConfigs are loaded
  useEffect(() => {
    if (departmentRosterConfigs.length > 0) {
      setDeptConfigs(DEPARTMENTS.map(dept => {
        const dbConfig = departmentRosterConfigs.find(d => d.name === dept);
        const isGeneralOnly = dept === 'HR' || dept === 'Vendor Coordinator';
        return {
          department: dept,
          defaultShift: isGeneralOnly ? 'general' : 'afternoon',
          rotateShifts: dbConfig?.rotation_enabled ?? !isGeneralOnly,
          availableShifts: isGeneralOnly ? ['general'] : ['afternoon', 'morning', 'night'],
          workDaysPerCycle: dbConfig?.work_days_per_cycle ?? 5,
          offDaysPerCycle: dbConfig?.off_days_per_cycle ?? 2,
        };
      }));
    } else {
      // Default configs before DB loads
      setDeptConfigs(DEPARTMENTS.map(dept => ({
        department: dept,
        defaultShift: dept === 'HR' || dept === 'Vendor Coordinator' ? 'general' : 'afternoon',
        rotateShifts: dept !== 'HR' && dept !== 'Vendor Coordinator',
        availableShifts: dept === 'HR' || dept === 'Vendor Coordinator' ? ['general'] : ['afternoon', 'morning', 'night'],
        workDaysPerCycle: 5,
        offDaysPerCycle: 2,
      })));
    }
  }, [departmentRosterConfigs]);
  const nextMonth = addMonths(new Date(), 1);
  const monthStart = startOfMonth(nextMonth);
  const monthEnd = endOfMonth(nextMonth);
  const monthName = format(nextMonth, 'MMMM yyyy');
  const totalDays = eachDayOfInterval({
    start: monthStart,
    end: monthEnd
  }).length;

  // State to hold previous month's last assignments for continuity
  const [previousMonthState, setPreviousMonthState] = useState<Record<string, {
    shift: ShiftType;
    workDaysInCurrent: number;
    offDaysUsed: number;
  }>>({});

  // Fetch rotation config and states when dialog opens
  useEffect(() => {
    if (open) {
      fetchRotationData();
      fetchHolidays();
      fetchPreviousMonthState();
      fetchDepartmentConfigs();
    }
  }, [open]);

  // Fetch department roster configs
  const fetchDepartmentConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, work_days_per_cycle, off_days_per_cycle, rotation_enabled')
        .eq('is_active', true);
      
      if (error) throw error;
      if (data) {
        setDepartmentRosterConfigs(data as DepartmentRosterConfig[]);
      }
    } catch (error) {
      console.error('Error fetching department configs:', error);
    }
  };

  // Fetch last assignments from previous month for cross-month continuity
  const fetchPreviousMonthState = async () => {
    try {
      const prevMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      const prevMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

      // Get last 14 days of previous month to understand cycle position (longer window for accuracy)
      const lastDaysStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 14), 'yyyy-MM-dd');
      
      const {
        data: lastAssignments,
        error
      } = await supabase.from('shift_assignments').select('member_id, date, shift_type')
        .gte('date', lastDaysStart)
        .lte('date', prevMonthEnd)
        .order('date', { ascending: false });

      if (error) throw error;
      
      if (lastAssignments && lastAssignments.length > 0) {
        // Group by member and calculate their end-of-month state
        const stateMap: Record<string, {
          shift: ShiftType;
          workDaysInCurrent: number;
          offDaysUsed: number;
        }> = {};
        const memberAssignments: Record<string, any[]> = {};
        lastAssignments.forEach(a => {
          if (!memberAssignments[a.member_id]) memberAssignments[a.member_id] = [];
          memberAssignments[a.member_id].push(a);
        });
        
        Object.entries(memberAssignments).forEach(([memberId, assignments]) => {
          // Sort by date descending to get most recent first
          assignments.sort((a, b) => b.date.localeCompare(a.date));

          // IMPORTANT: Exclude leave types (paid-leave, sick-leave) from continuity calculation
          // Only consider actual work shifts and scheduled offs
          const workableAssignments = assignments.filter(a => 
            a.shift_type !== 'paid-leave' && 
            a.shift_type !== 'sick-leave' &&
            a.shift_type !== 'casual-leave'
          );

          // Find the most recent actual work shift (not OFF or leave)
          const lastWorkShift = workableAssignments.find(a => 
            a.shift_type !== 'week-off' && 
            a.shift_type !== 'public-off' && 
            a.shift_type !== 'comp-off'
          );

          // Count consecutive work days at end of month (not interrupted by OFF)
          let workDaysInCurrent = 0;
          let offDaysUsed = 0;
          
          for (const a of workableAssignments) {
            if (a.shift_type === 'week-off' || a.shift_type === 'public-off' || a.shift_type === 'comp-off') {
              offDaysUsed++;
              if (workDaysInCurrent > 0) {
                break; // We've counted consecutive work days before hitting OFF
              }
            } else {
              workDaysInCurrent++;
            }
          }
          
          if (lastWorkShift) {
            stateMap[memberId] = {
              shift: lastWorkShift.shift_type as ShiftType,
              workDaysInCurrent,
              offDaysUsed: Math.min(offDaysUsed, 2) // Cap at 2 for calculation purposes
            };
          }
        });
        
        setPreviousMonthState(stateMap);
        console.log('Previous month state loaded:', Object.keys(stateMap).length, 'members');
      }
    } catch (error) {
      console.error('Error fetching previous month state:', error);
    }
  };
  const fetchRotationData = async () => {
    setLoadingRotation(true);
    try {
      const [configRes, statesRes] = await Promise.all([supabase.from('rotation_config').select('*').eq('is_active', true).maybeSingle(), supabase.from('member_rotation_state').select('*')]);
      if (configRes.error) throw configRes.error;
      if (statesRes.error) throw statesRes.error;
      if (configRes.data) {
        const config = configRes.data as any;
        setRotationConfig({
          ...config,
          shift_sequence: config.shift_sequence || ['afternoon', 'morning', 'night']
        });
      }
      const existingStates = statesRes.data || [];
      setRotationStates(existingStates);

      // Auto-initialize uninitialized members
      const initializedIds = new Set(existingStates.map((s: MemberRotationState) => s.member_id));
      const membersToInit = teamMembers.filter(m => ROTATING_DEPARTMENTS.includes(m.department) && m.role !== 'TL' && !initializedIds.has(m.id));
      if (membersToInit.length > 0 && configRes.data) {
        const shiftSequence = configRes.data.shift_sequence || ['afternoon', 'morning', 'night'];
        const newStates = membersToInit.map(m => ({
          member_id: m.id,
          current_shift_type: shiftSequence[0],
          cycle_start_date: format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd')
        }));
        const {
          data: insertedStates,
          error: insertError
        } = await supabase.from('member_rotation_state').insert(newStates).select();
        if (insertError) {
          console.error('Error auto-initializing members:', insertError);
        } else if (insertedStates) {
          setRotationStates([...existingStates, ...(insertedStates as MemberRotationState[])]);
          toast.success(`Auto-initialized ${insertedStates.length} members`);
        }
      }
    } catch (error) {
      console.error('Error fetching rotation data:', error);
    } finally {
      setLoadingRotation(false);
    }
  };
  const fetchHolidays = async () => {
    const {
      data
    } = await supabase.from('public_holidays').select('date').gte('date', format(monthStart, 'yyyy-MM-dd')).lte('date', format(monthEnd, 'yyyy-MM-dd'));
    if (data) {
      setPublicHolidays(data.map(h => h.date));
    }
  };
  const updateDeptConfig = (dept: Department, updates: Partial<DepartmentShiftConfig>) => {
    setDeptConfigs(prev => prev.map(config => config.department === dept ? {
      ...config,
      ...updates
    } : config));
  };

  // State to track if configs have unsaved changes
  const [configsModified, setConfigsModified] = useState(false);
  const [savingConfigs, setSavingConfigs] = useState(false);

  // Save department configs to database
  const saveDepartmentConfigs = async (showToast = true) => {
    setSavingConfigs(true);
    try {
      const updatePromises = deptConfigs.map(async config => {
        const dbConfig = departmentRosterConfigs.find(d => d.name === config.department);
        if (dbConfig) {
          await supabase
            .from('departments')
            .update({
              work_days_per_cycle: config.workDaysPerCycle,
              off_days_per_cycle: config.offDaysPerCycle,
              rotation_enabled: config.rotateShifts,
            })
            .eq('id', dbConfig.id);
        }
      });
      await Promise.all(updatePromises);
      setConfigsModified(false);
      if (showToast) {
        toast.success('Department configurations saved successfully');
      }
    } catch (error) {
      console.error('Error saving department configs:', error);
      toast.error('Failed to save department configurations');
    } finally {
      setSavingConfigs(false);
    }
  };

  // Track modifications when dept configs change
  const updateDeptConfigWithTracking = (dept: Department, updates: Partial<DepartmentShiftConfig>) => {
    setDeptConfigs(prev => prev.map(config => config.department === dept ? {
      ...config,
      ...updates
    } : config));
    setConfigsModified(true);
  };

  // Get uninitialized members
  const uninitializedMembers = useMemo(() => {
    const initializedIds = new Set(rotationStates.map(s => s.member_id));
    return filteredTeamMembers.filter(m => ROTATING_DEPARTMENTS.includes(m.department) && m.role !== 'TL' && !initializedIds.has(m.id));
  }, [filteredTeamMembers, rotationStates]);
  const generateAssignments = (): PreviewAssignment[] => {
    const days = eachDayOfInterval({
      start: monthStart,
      end: monthEnd
    });
    const assignments: PreviewAssignment[] = [];

    // IMPORTANT: Always generate for ALL team members, not just filtered ones
    const allMembers = teamMembers;

    // Build rotation state lookup
    const stateMap: Record<string, MemberRotationState> = {};
    rotationStates.forEach(s => {
      stateMap[s.member_id] = s;
    });

    // ========================
    // CONSTANTS FROM REQUIREMENTS
    // ========================
    const MIN_CONSECUTIVE_WORK_DAYS = 3;
    const MAX_CONSECUTIVE_WORK_DAYS = 7;
    const STANDARD_WORK_DAYS = 5;
    const NIGHT_SHIFT_MIN_REST = 1;
    const NIGHT_SHIFT_PREFERRED_REST = 2;

    // Track each member's comprehensive state with cross-month continuity
    interface MemberCycleTracker {
      consecutiveWorkDays: number; // Must be 3-7
      offDaysRemaining: number; // Based on department or user's week_off_entitlement
      weekOffEntitlement: number; // From department config or user setting
      standardWorkDays: number; // From department config
      workDaysInCurrentShift: number; // For shift stability (rotate after 10)
      currentShift: ShiftType; // Current assigned shift type
      lastShiftType: ShiftType | null; // Previous shift for night transition check
      pendingNightTransition: boolean; // Need rest before night
      pendingShiftRotation: boolean; // Rotation pending, apply after next OFF cycle
      offDaysInRolling7: number[]; // Track OFF days in rolling 7-day window
    }
    const memberTrackers: Record<string, MemberCycleTracker> = {};

    // Get department config lookup
    const getDeptConfig = (dept: string) => deptConfigs.find(c => c.department === dept);

    // Initialize trackers using previous month state for MONTH BOUNDARY CONTINUITY
    allMembers.forEach(member => {
      const isRotating = ROTATING_DEPARTMENTS.includes(member.department) && member.role !== 'TL' && member.role !== 'Manager';
      const isGeneralShift = GENERAL_SHIFT_DEPARTMENTS.includes(member.department) || member.role === 'TL' || member.role === 'Manager';

      // Get department-specific config
      const deptConfig = getDeptConfig(member.department);
      const deptWorkDays = deptConfig?.workDaysPerCycle ?? STANDARD_WORK_DAYS;
      const deptOffDays = deptConfig?.offDaysPerCycle ?? 2;
      
      // Use department config, fallback to user's week-off entitlement, then default to 2
      const weekOffEntitlement = deptOffDays || ((member as any).weekOffEntitlement || 2);
      const standardWorkDays = deptWorkDays || STANDARD_WORK_DAYS;
      
      const prevState = previousMonthState[member.id];
      const rotationState = stateMap[member.id];

      // Check if transitioning from morning to night (needs rest)
      const lastShift = prevState?.shift || rotationState?.current_shift_type || SHIFT_ROTATION_ORDER[0];
      const nextShiftInRotation = SHIFT_ROTATION_ORDER[(SHIFT_ROTATION_ORDER.indexOf(lastShift as any) + 1) % 3];
      const pendingNightTransition = lastShift === 'morning' && nextShiftInRotation === 'night' && prevState?.workDaysInCurrent >= MIN_CONSECUTIVE_WORK_DAYS;
      
      // IMPORTANT: Check last month's week-off usage for continuity
      // If member had OFF days at end of last month, they should continue work cycle
      // If member was working at end of last month, check if they're due for OFF
      const wasOnOffAtMonthEnd = prevState?.offDaysUsed && prevState.offDaysUsed > 0;
      const continuingOffDays = wasOnOffAtMonthEnd 
        ? Math.max(0, weekOffEntitlement - prevState.offDaysUsed) 
        : weekOffEntitlement;
      
      memberTrackers[member.id] = {
        // MONTH BOUNDARY CONTINUITY: Continue from previous month's work day count
        consecutiveWorkDays: prevState?.workDaysInCurrent || 0,
        offDaysRemaining: continuingOffDays,
        weekOffEntitlement,
        standardWorkDays,
        workDaysInCurrentShift: 0,
        currentShift: (prevState?.shift || rotationState?.current_shift_type || SHIFT_ROTATION_ORDER[0]) as ShiftType,
        lastShiftType: null,
        pendingNightTransition,
        pendingShiftRotation: false,
        offDaysInRolling7: []
      };
    });

    // Stagger OFF days across team members to avoid everyone being off on same day
    const memberOffsets: Record<string, number> = {};
    const rotatingMembers = allMembers.filter(m => ROTATING_DEPARTMENTS.includes(m.department) && m.role !== 'TL' && m.role !== 'Manager');
    rotatingMembers.forEach((member, index) => {
      memberOffsets[member.id] = index % 7;
    });
    days.forEach((day, dayIndex) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isPublicHoliday = publicHolidays.includes(dateStr);
      allMembers.forEach(member => {
        const isRotating = ROTATING_DEPARTMENTS.includes(member.department) && member.role !== 'TL' && member.role !== 'Manager';
        const isGeneralOnly = GENERAL_SHIFT_DEPARTMENTS.includes(member.department) || member.role === 'TL' || member.role === 'Manager';

        // Public holiday - everyone gets off
        if (isPublicHoliday) {
          assignments.push({
            member_id: member.id,
            shift_type: 'public-off',
            date: dateStr,
            department: member.department as Department
          });
          // Public holiday resets consecutive work days
          const tracker = memberTrackers[member.id];
          if (tracker) {
            tracker.consecutiveWorkDays = 0;
            tracker.offDaysRemaining = tracker.weekOffEntitlement;
            tracker.offDaysInRolling7.push(dayIndex);
          }
          return;
        }

        // General shift workers (TLs, Managers, HR, Admin, etc.) - still get week-offs
        if (isGeneralOnly) {
          const tracker = memberTrackers[member.id];
          if (!tracker) {
            // Initialize tracker for general shift workers
            const deptConfig = getDeptConfig(member.department);
            const deptWorkDays = deptConfig?.workDaysPerCycle ?? STANDARD_WORK_DAYS;
            const deptOffDays = deptConfig?.offDaysPerCycle ?? 2;
            const weekOffEntitlement = deptOffDays || ((member as any).weekOffEntitlement || 2);
            
            memberTrackers[member.id] = {
              consecutiveWorkDays: 0,
              offDaysRemaining: weekOffEntitlement,
              weekOffEntitlement,
              standardWorkDays: deptWorkDays,
              workDaysInCurrentShift: 0,
              currentShift: 'general',
              lastShiftType: null,
              pendingNightTransition: false,
              pendingShiftRotation: false,
              offDaysInRolling7: []
            };
          }
          const t = memberTrackers[member.id];
          const memberOffset = memberOffsets[member.id] || allMembers.indexOf(member) % 7;

          // HARD LIMIT: Max 7 consecutive work days
          let shouldBeOff = t.consecutiveWorkDays >= MAX_CONSECUTIVE_WORK_DAYS;

          // Use department-specific standard work days (default: 5 work + configured off days)
          if (!shouldBeOff && t.consecutiveWorkDays >= t.standardWorkDays && t.offDaysRemaining > 0) {
            shouldBeOff = true;
          }

          // Rolling 7-day compliance check
          if (!shouldBeOff) {
            const offDaysInWindow = t.offDaysInRolling7.filter(d => d > dayIndex - 7).length;
            if (offDaysInWindow < t.weekOffEntitlement && t.consecutiveWorkDays >= MIN_CONSECUTIVE_WORK_DAYS) {
              // Risk of violating rolling 7-day rule
              shouldBeOff = true;
            }
          }
          // Check if member is in the middle of consecutive off days (for general shift)
          const isInConsecutiveOffGeneral = t.offDaysRemaining < t.weekOffEntitlement && t.consecutiveWorkDays === 0;

          if (shouldBeOff || isInConsecutiveOffGeneral) {
            assignments.push({
              member_id: member.id,
              shift_type: 'week-off',
              date: dateStr,
              department: member.department as Department
            });
            t.consecutiveWorkDays = 0;
            t.offDaysRemaining--;
            t.offDaysInRolling7.push(dayIndex);
            if (t.offDaysRemaining <= 0) {
              t.offDaysRemaining = t.weekOffEntitlement;
            }
            return;
          }
          assignments.push({
            member_id: member.id,
            shift_type: 'general',
            date: dateStr,
            department: member.department as Department
          });
          t.consecutiveWorkDays++;
          return;
        }

        // Rotating members with comprehensive rules
        if (isRotating && use15DayRotation) {
          const tracker = memberTrackers[member.id];
          const memberOffset = memberOffsets[member.id] || 0;

          // ========================
          // WEEK-OFF DECISION LOGIC
          // ========================

          let shouldBeOff = false;
          let offReason = '';

          // RULE 1 (HARD LIMIT): MUST give week-off if reached max consecutive work days (7)
          if (tracker.consecutiveWorkDays >= MAX_CONSECUTIVE_WORK_DAYS) {
            shouldBeOff = true;
            offReason = 'max_work_days_exceeded';
          }

          // RULE 2: Night shift transition safety (mandatory rest before night)
          else if (tracker.pendingNightTransition && tracker.consecutiveWorkDays >= MIN_CONSECUTIVE_WORK_DAYS) {
            // PREFERRED: 2 consecutive OFF days before night
            // FALLBACK: 1 OFF day minimum, then 1 more after 3 work days
            shouldBeOff = true;
            offReason = 'pre_night_safety';
            tracker.pendingNightTransition = false;
          }

          // RULE 3: Department-specific work pattern (use configured work days + OFF based on entitlement)
          else if (tracker.consecutiveWorkDays >= tracker.standardWorkDays && tracker.offDaysRemaining > 0) {
            shouldBeOff = true;
            offReason = 'standard_cycle';
          }

          // RULE 4: Rolling 7-day compliance (must get entitlement within any 7-day window)
          else {
            const offDaysInWindow = tracker.offDaysInRolling7.filter(d => d > dayIndex - 7).length;
            if (offDaysInWindow < tracker.weekOffEntitlement && tracker.consecutiveWorkDays >= MIN_CONSECUTIVE_WORK_DAYS) {
              // We're at risk of violating 7-day rule if we don't take OFF now
              shouldBeOff = true;
              offReason = 'rolling_7day_compliance';
            }
          }

          // HARD LIMIT: Never work fewer than 3 days between OFF cycles (except month carryover)
          // This prevents taking OFF too early
          if (shouldBeOff && tracker.consecutiveWorkDays < MIN_CONSECUTIVE_WORK_DAYS && offReason !== 'max_work_days_exceeded') {
            // Exception: if it's month start and continuing from previous month
            if (dayIndex > 0 || previousMonthState[member.id]?.workDaysInCurrent >= MIN_CONSECUTIVE_WORK_DAYS) {
              shouldBeOff = false;
            }
          }

          // ========================
          // ASSIGN SHIFT OR WEEK-OFF
          // ========================

          // Check if member is in the middle of consecutive off days
          const isInConsecutiveOff = tracker.offDaysRemaining < tracker.weekOffEntitlement && tracker.consecutiveWorkDays === 0;

          if (shouldBeOff || isInConsecutiveOff) {
            assignments.push({
              member_id: member.id,
              shift_type: 'week-off',
              date: dateStr,
              department: member.department as Department
            });
            tracker.consecutiveWorkDays = 0;
            tracker.offDaysRemaining--;
            tracker.offDaysInRolling7.push(dayIndex);

            // Reset off entitlement after all OFFs given (consecutive days completed)
            if (tracker.offDaysRemaining <= 0) {
              tracker.offDaysRemaining = tracker.weekOffEntitlement;

              // Apply pending shift rotation ONLY after OFF cycle completes
              // This ensures no mid-week shift changes within a 5-day work block
              if (tracker.pendingShiftRotation || tracker.workDaysInCurrentShift >= SHIFT_STABILITY_WORK_DAYS) {
                const currentIndex = SHIFT_ROTATION_ORDER.indexOf(tracker.currentShift as any);
                const nextIndex = (currentIndex + 1) % SHIFT_ROTATION_ORDER.length;
                const nextShift = SHIFT_ROTATION_ORDER[nextIndex] as ShiftType;

                // Check if transitioning TO night from morning
                if (nextShift === 'night' && tracker.currentShift === 'morning') {
                  tracker.pendingNightTransition = true;
                }
                tracker.currentShift = nextShift;
                tracker.workDaysInCurrentShift = 0;
                tracker.pendingShiftRotation = false;
              }
            }
            return;
          }

          // WORK DAY - assign current shift
          // NOTE: Shift rotation only happens AFTER OFF days (see lines 475-486)
          // This ensures no mid-week shift changes within a 5-day work block
          let currentShift = tracker.currentShift;

          // ========================
          // DC ROLE AVAILABILITY CHECK (Infra Team)
          // ========================
          // For Infra department members, check if their role is allowed for this shift
          // at their assigned datacenter
          if (member.department === 'Infra' && member.datacenterId && !infraSettings.loading) {
            const isEligible = isRoleEligibleForShift(
              infraSettings.dcRoleAvailability,
              member.datacenterId,
              member.role,
              currentShift as 'morning' | 'afternoon' | 'night' | 'general'
            );

            // If not eligible for current shift, try to find an eligible shift
            if (!isEligible) {
              const eligibleShifts = ['morning', 'afternoon', 'night', 'general'].filter(
                shift => isRoleEligibleForShift(
                  infraSettings.dcRoleAvailability,
                  member.datacenterId,
                  member.role,
                  shift as 'morning' | 'afternoon' | 'night' | 'general'
                )
              );

              if (eligibleShifts.length > 0) {
                // Pick the first eligible shift that's closest in the rotation order
                const rotationShifts = SHIFT_ROTATION_ORDER.filter(s => eligibleShifts.includes(s));
                if (rotationShifts.length > 0) {
                  currentShift = rotationShifts[0] as ShiftType;
                } else if (eligibleShifts.includes('general')) {
                  currentShift = 'general';
                } else {
                  currentShift = eligibleShifts[0] as ShiftType;
                }
              }
            }
          }

          // Track if rotation is pending (will apply after next OFF cycle)
          if (tracker.workDaysInCurrentShift >= SHIFT_STABILITY_WORK_DAYS && !tracker.pendingShiftRotation) {
            tracker.pendingShiftRotation = true;
          }

          assignments.push({
            member_id: member.id,
            shift_type: currentShift,
            date: dateStr,
            department: member.department as Department
          });
          tracker.consecutiveWorkDays++;
          tracker.workDaysInCurrentShift++;
          tracker.lastShiftType = currentShift;
          return;
        }

        // Fallback: use department config
        const config = deptConfigs.find(c => c.department === member.department);
        if (config) {
          assignments.push({
            member_id: member.id,
            shift_type: config.defaultShift,
            date: dateStr,
            department: member.department as Department
          });
        }
      });
    });
    return assignments;
  };
  const handleGeneratePreview = () => {
    const assignments = generateAssignments();
    setPreviewAssignments(assignments);
    setStep('continuity'); // First show continuity preview
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
            department: member.department as Department
          });
        }
      }
      return filtered;
    });
  };
  // Apply single-person night shift WFH rule
  // If only one person is at a location on night shift, mark them as WFH
  const applySinglePersonNightWfhRule = (assignments: PreviewAssignment[]): PreviewAssignment[] => {
    // Group night shift assignments by date and location
    const nightShiftsByDateLocation: Record<string, { memberId: string; locationId?: string }[]> = {};
    
    assignments.forEach(a => {
      if (a.shift_type === 'night') {
        const member = teamMembers.find(m => m.id === a.member_id);
        const locationId = member?.workLocationId;
        if (locationId) {
          const key = `${a.date}_${locationId}`;
          if (!nightShiftsByDateLocation[key]) {
            nightShiftsByDateLocation[key] = [];
          }
          nightShiftsByDateLocation[key].push({ memberId: a.member_id, locationId });
        }
      }
    });
    
    // Find locations with only one person on night shift
    const singlePersonNightShifts = new Set<string>();
    Object.entries(nightShiftsByDateLocation).forEach(([key, members]) => {
      if (members.length === 1) {
        // Only one person at this location on this date for night shift
        const [date, _] = key.split('_');
        singlePersonNightShifts.add(`${date}_${members[0].memberId}`);
      }
    });
    
    // Note: In a full implementation, we would update the work_location_id on the assignment
    // to mark them as WFH. For now, we'll log it but the assignment still gets created.
    // The UI should show a warning for these cases.
    if (singlePersonNightShifts.size > 0) {
      console.log('Single person night shifts (should be WFH):', singlePersonNightShifts);
    }
    
    return assignments;
  };

  const handleSaveRoster = async (saveStatus: RosterSaveStatus = 'draft') => {
    setLoading(true);
    try {
      // Save department configs first
      await saveDepartmentConfigs();
      
      // Apply single-person night WFH rule
      const processedAssignments = applySinglePersonNightWfhRule(previewAssignments);
      
      // Delete existing assignments for next month
      const {
        error: deleteError
      } = await supabase.from('shift_assignments').delete().gte('date', format(monthStart, 'yyyy-MM-dd')).lte('date', format(monthEnd, 'yyyy-MM-dd'));
      if (deleteError) throw deleteError;

      // Insert new assignments with status in batches
      const batchSize = 100;
      for (let i = 0; i < processedAssignments.length; i += batchSize) {
        const batch = processedAssignments.slice(i, i + batchSize).map(a => ({
          ...a,
          status: saveStatus
        }));
        const {
          error: insertError
        } = await supabase.from('shift_assignments').insert(batch);
        if (insertError) throw insertError;
      }

      // UPDATE MEMBER ROTATION STATE for seamless month-to-month continuity
      // This ensures the next month's roster picks up from the correct shift and cycle position
      const lastDayStr = format(monthEnd, 'yyyy-MM-dd');
      const memberLastShifts: Record<string, { shift: ShiftType; workDays: number }> = {};

      // Group assignments by member and find their end-of-month state
      const memberAssignments: Record<string, PreviewAssignment[]> = {};
      processedAssignments.forEach(a => {
        if (!memberAssignments[a.member_id]) memberAssignments[a.member_id] = [];
        memberAssignments[a.member_id].push(a);
      });

      // Calculate each member's state at end of month
      Object.entries(memberAssignments).forEach(([memberId, assignments]) => {
        // Sort by date descending
        assignments.sort((a, b) => b.date.localeCompare(a.date));
        
        // Find last non-off shift to determine current shift type
        const lastWorkShift = assignments.find(a => 
          a.shift_type !== 'week-off' && 
          a.shift_type !== 'public-off' && 
          a.shift_type !== 'comp-off'
        );

        // Count consecutive work days at end of month
        let consecutiveWorkDays = 0;
        for (const a of assignments) {
          if (a.shift_type === 'week-off' || a.shift_type === 'public-off' || a.shift_type === 'comp-off') {
            break; // Stop counting when we hit an off day
          }
          consecutiveWorkDays++;
        }

        if (lastWorkShift) {
          memberLastShifts[memberId] = {
            shift: lastWorkShift.shift_type,
            workDays: consecutiveWorkDays
          };
        }
      });

      // Update member_rotation_state for each member
      const updatePromises = Object.entries(memberLastShifts).map(async ([memberId, state]) => {
        // Use upsert to handle both existing and new records
        return supabase.from('member_rotation_state').upsert({
          member_id: memberId,
          current_shift_type: state.shift,
          cycle_start_date: lastDayStr, // Use last day as reference for next month
          updated_at: new Date().toISOString()
        }, { onConflict: 'member_id' });
      });

      await Promise.all(updatePromises);

      const weekOffsCount = processedAssignments.filter(a => a.shift_type === 'week-off').length;
      const statusLabel = saveStatus === 'draft' ? 'saved as draft' : 'published';
      toast.success(`Monthly roster for ${monthName} ${statusLabel}!`, {
        description: `${processedAssignments.length} assignments (${weekOffsCount} week-offs). Rotation state updated for ${Object.keys(memberLastShifts).length} members.`
      });
      setOpen(false);
      setStep('config');
      onComplete?.();
    } catch (error) {
      console.error('Error saving roster:', error);
      toast.error('Failed to save roster', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
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
  return <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <CalendarPlus size={16} />
          Setup {format(nextMonth, 'MMM')} Roster
        </Button>
      </DialogTrigger>
      <DialogContent className={step === 'preview' || step === 'continuity' ? "max-w-[95vw] max-h-[95vh]" : "max-w-2xl max-h-[90vh]"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'config' ? <Settings2 size={20} /> : <Eye size={20} />}
            {step === 'config' 
              ? 'Setup Monthly Roster' 
              : step === 'continuity'
                ? 'Rotation Continuity Preview'
                : 'Preview & Edit Roster'}
          </DialogTitle>
          <DialogDescription>
            {step === 'config' 
              ? `Configure shift assignments for ${monthName}` 
              : step === 'continuity'
                ? 'Review how shifts will continue from the previous month before viewing full roster.'
                : `Review and edit shifts before saving. Click any cell to change shift.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'config' ? <>
            {/* Department Multi-Selector */}
            <div className="rounded-lg border p-4 mb-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-base">Select Departments</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose which departments to set up roster for (leave empty for all)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {departments.map(dept => {
                    const isSelected = selectedDepartments.includes(dept.name);
                    const memberCount = teamMembers.filter(m => m.department === dept.name).length;
                    if (memberCount === 0) return null;
                    return (
                      <Button
                        key={dept.id}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedDepartments(prev => prev.filter(d => d !== dept.name));
                          } else {
                            setSelectedDepartments(prev => [...prev, dept.name]);
                          }
                        }}
                        className="gap-1"
                      >
                        {dept.name}
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {memberCount}
                        </Badge>
                      </Button>
                    );
                  })}
                </div>
                {selectedDepartments.length > 0 && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-primary">
                      Roster will be generated for {filteredTeamMembers.length} member(s) in {selectedDepartments.length} department(s)
                    </p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedDepartments([])}
                      className="text-xs h-6"
                    >
                      Clear selection
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Tabs defaultValue="rotation" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="rotation">{rotationConfig?.rotation_cycle_days || 14}-Day Rotation</TabsTrigger>
                <TabsTrigger value="shifts">Department Shifts</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
              </TabsList>

              <TabsContent value="rotation" className="space-y-4 mt-4">
                {/* 15-Day Rotation Toggle */}
                <div className="rounded-lg border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Rotational Policy</Label>
                      <p className="text-sm text-muted-foreground">
                        Each member works {rotationConfig?.rotation_cycle_days || 14} days in one shift, then rotates
                      </p>
                    </div>
                    <Switch checked={use15DayRotation} onCheckedChange={setUse15DayRotation} />
                  </div>

                  {use15DayRotation && rotationConfig && <>
                      <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="text-sm text-muted-foreground">Cycle Length:</span>
                          <span className="ml-2 font-medium">{rotationConfig.rotation_cycle_days} days</span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Sequence:</span>
                          <span className="ml-2 font-medium">
                            {(rotationConfig.shift_sequence || ['A', 'M', 'N']).map((s: string) => s.charAt(0).toUpperCase()).join(' → ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Weekly Offs:</span>
                          <span className="ml-2 font-medium">{rotationConfig.off_days} days off pattern</span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Total Members:</span>
                          <span className="ml-2 font-medium">
                            {teamMembers.length} members ({rotationStates.length} initialized)
                          </span>
                        </div>
                      </div>

                      {/* Uninitialized members warning */}
                      {uninitializedMembers.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="text-amber-600 mt-0.5" size={16} />
                            <div className="flex-1">
                              <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                                {uninitializedMembers.length} member(s) not initialized
                              </p>
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                These members will use the first shift in sequence. Initialize them in Settings → Rotation for accurate tracking.
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {uninitializedMembers.slice(0, 5).map(m => <Badge key={m.id} variant="outline" className="text-xs">
                                    {m.name}
                                  </Badge>)}
                                {uninitializedMembers.length > 5 && <Badge variant="outline" className="text-xs">
                                    +{uninitializedMembers.length - 5} more
                                  </Badge>}
                              </div>
                            </div>
                          </div>
                        </div>}

                      {/* Pattern Example */}
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-sm font-medium mb-2">Example Pattern</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Badge className="bg-amber-500 text-white">Days 1-{rotationConfig.rotation_cycle_days}</Badge>
                            <span>Afternoon</span>
                          </div>
                          <span className="text-muted-foreground">→</span>
                          <div className="flex items-center gap-1">
                            <Badge className="bg-blue-500 text-white">Days {rotationConfig.rotation_cycle_days + 1}-{rotationConfig.rotation_cycle_days * 2}</Badge>
                            <span>Morning</span>
                          </div>
                          <span className="text-muted-foreground">→</span>
                          <div className="flex items-center gap-1">
                            <Badge className="bg-purple-600 text-white">Days {rotationConfig.rotation_cycle_days * 2 + 1}-{rotationConfig.rotation_cycle_days * 3}</Badge>
                            <span>Night</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          2 days off in each week of the cycle
                        </p>
                      </div>
                    </>}

                  {use15DayRotation && !rotationConfig && <div className="text-center py-4 text-muted-foreground">
                      <p>No rotation configuration found.</p>
                      <p className="text-sm">Go to Settings → Shift Rules to configure.</p>
                    </div>}

                  {!use15DayRotation && <div className="text-center py-4 text-muted-foreground">
                      <p>Legacy mode: shifts will be assigned based on department configuration</p>
                    </div>}
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
                    {deptConfigs.map(config => {
                  const memberCount = teamMembers.filter(m => m.department === config.department).length;
                  if (memberCount === 0) return null;
                  return <div key={config.department} className="rounded-lg border p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{config.department}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                ({memberCount} members)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Rotate</Label>
                              <Switch checked={config.rotateShifts} onCheckedChange={rotate => updateDeptConfigWithTracking(config.department, {
                          rotateShifts: rotate
                        })} />
                            </div>
                          </div>

                          {/* Work Days and Off Days Configuration */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Work Days/Cycle</Label>
                              <Select 
                                value={String(config.workDaysPerCycle)} 
                                onValueChange={v => updateDeptConfigWithTracking(config.department, {
                                  workDaysPerCycle: parseInt(v)
                                })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[3, 4, 5, 6, 7].map(d => (
                                    <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Off Days/Cycle</Label>
                              <Select 
                                value={String(config.offDaysPerCycle)} 
                                onValueChange={v => updateDeptConfigWithTracking(config.department, {
                                  offDaysPerCycle: parseInt(v)
                                })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3].map(d => (
                                    <SelectItem key={d} value={String(d)}>{d} day{d > 1 ? 's' : ''}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Default Shift</Label>
                              <Select value={config.defaultShift} onValueChange={v => updateDeptConfigWithTracking(config.department, {
                                defaultShift: v as ShiftType
                              })}>
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SHIFT_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {config.rotateShifts && <div className="space-y-1">
                              <Label className="text-xs">Rotate Through</Label>
                              <div className="flex gap-1 flex-wrap">
                                {(['morning', 'afternoon', 'night'] as ShiftType[]).map(shift => <Button key={shift} variant={config.availableShifts.includes(shift) ? "default" : "outline"} size="sm" className="h-7 px-2 text-xs" onClick={() => {
                          const newShifts = config.availableShifts.includes(shift) ? config.availableShifts.filter(s => s !== shift) : [...config.availableShifts, shift];
                          if (newShifts.length > 0) {
                            updateDeptConfigWithTracking(config.department, {
                              availableShifts: newShifts
                            });
                          }
                        }}>
                                    {shift.charAt(0).toUpperCase() + shift.slice(1, 3)}
                                  </Button>)}
                              </div>
                            </div>}
                        </div>;
                })}
                  </div>
                </ScrollArea>
                
                {/* Save Config Button */}
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {configsModified ? (
                      <span className="text-amber-600 font-medium">• Unsaved changes</span>
                    ) : (
                      <span>Configuration in sync with database</span>
                    )}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveDepartmentConfigs(true)}
                    disabled={!configsModified || savingConfigs}
                    className="gap-2"
                  >
                    {savingConfigs ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Save Config
                  </Button>
                </div>
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
                    <span>{selectedDepartments.length === 0 ? 'All Departments' : selectedDepartments.join(', ')}</span>
                    <span className="text-muted-foreground">Team Members:</span>
                    <span>{filteredTeamMembers.length}</span>
                    <span className="text-muted-foreground">Rotation:</span>
                    <span>
                      {use15DayRotation && rotationConfig ? `${rotationConfig.rotation_cycle_days}-day cycle with 2+2 offs` : 'Legacy mode'}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-3">Department Configuration</h4>
                  <div className="space-y-2 text-sm">
                    {deptConfigs.filter(c => filteredTeamMembers.some(m => m.department === c.department)).map(config => (
                      <div key={config.department} className="flex justify-between items-center py-1 border-b last:border-0">
                        <span className="font-medium">{config.department}</span>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span>{config.workDaysPerCycle} work + {config.offDaysPerCycle} off</span>
                          <span className="text-xs px-2 py-0.5 bg-muted rounded">
                            {config.rotateShifts ? config.availableShifts.map(s => s.charAt(0).toUpperCase()).join('/') : config.defaultShift.charAt(0).toUpperCase() + config.defaultShift.slice(1)}
                          </span>
                        </div>
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
                Preview Continuity & Roster
              </Button>
            </DialogFooter>
          </> : step === 'continuity' ? <>
            {/* Continuity Preview Step */}
            <ScrollArea className="h-[60vh]">
              <RotationContinuityPreview 
                teamMembers={filteredTeamMembers} 
                previousMonthState={previousMonthState} 
              />
            </ScrollArea>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setStep('config')} className="gap-2">
                <ChevronLeft size={16} />
                Back to Config
              </Button>
              <Button onClick={() => setStep('preview')} className="gap-2">
                <Eye size={16} />
                View Full Roster
              </Button>
            </DialogFooter>
          </> : <>
            <ScrollArea className="h-[60vh]">
              <RosterPreviewTable assignments={previewAssignments} teamMembers={filteredTeamMembers} month={nextMonth} editable={true} onEditCell={handleEditPreviewCell} />
            </ScrollArea>

            <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
              <span>
                {previewAssignments.length} assignments • 
                {previewAssignments.filter(a => a.shift_type === 'week-off').length} week-offs
              </span>
              <span>Click any cell to cycle through shifts</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('continuity')} className="gap-2">
                <ChevronLeft size={16} />
                Back to Continuity
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => handleSaveRoster('draft')} 
                disabled={loading} 
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileCheck size={16} />
                )}
                Save as Draft
              </Button>
              <Button 
                onClick={() => handleSaveRoster('published')} 
                disabled={loading} 
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                Publish Roster
              </Button>
            </DialogFooter>
          </>}
      </DialogContent>
    </Dialog>;
}