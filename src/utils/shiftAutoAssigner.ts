import { 
  ShiftAssignment, 
  ShiftType, 
  TeamMember, 
  Department,
  Role 
} from '@/types/roster';
import { 
  ShiftCompositionRule,
  AutoAssignmentConfig,
  DEFAULT_ASSIGNMENT_CONFIG,
  ROLE_SHIFT_ELIGIBILITY,
  ROTATING_DEPARTMENTS,
  GENERAL_SHIFT_DEPARTMENTS,
  Datacenter,
  ShiftViolation,
  MemberRotationState,
  getMemberShiftTypeForDate,
  getWeekOffDaysInCycle,
} from '@/types/shiftRules';
import { format, eachDayOfInterval, differenceInDays, subDays, addDays, parseISO } from 'date-fns';

// ========================
// TYPES & INTERFACES
// ========================

interface MemberState {
  currentShift: ShiftType;
  consecutiveWorkDays: number;
  offDaysRemaining: number;
  lastShiftType: ShiftType | null;
  pendingNightTransition: boolean;
  workDaysInCurrentShift: number;
}

interface AssignmentContext {
  teamMembers: TeamMember[];
  rules: ShiftCompositionRule[];
  datacenters: Datacenter[];
  publicHolidays: string[];
  leaveRequests: { memberId: string; startDate: string; endDate: string }[];
  existingAssignments: ShiftAssignment[];
  config: AutoAssignmentConfig;
  memberRotationStates: MemberRotationState[];
  previousMonthAssignments?: ShiftAssignment[];
}

// ========================
// CONSTANTS
// ========================

const MIN_CONSECUTIVE_WORK_DAYS = 3;
const MAX_CONSECUTIVE_WORK_DAYS = 7;
const STANDARD_WORK_DAYS = 5;
const NIGHT_SHIFT_MIN_REST = 1;
const NIGHT_SHIFT_PREFERRED_REST = 2;

// ========================
// HELPER FUNCTIONS
// ========================

/**
 * Get week-off entitlement for a member (default: 2)
 */
function getWeekOffEntitlement(member: TeamMember): 1 | 2 {
  return member.weekOffEntitlement || 2;
}

/**
 * Calculate member state from previous month's assignments
 */
function calculateMemberStateFromHistory(
  memberId: string,
  previousAssignments: ShiftAssignment[],
  memberRotationState: MemberRotationState | undefined,
  weekOffEntitlement: 1 | 2
): MemberState {
  // Sort assignments by date descending to get most recent
  const memberAssignments = previousAssignments
    .filter(a => a.memberId === memberId)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (memberAssignments.length === 0) {
    return {
      currentShift: (memberRotationState?.current_shift_type as ShiftType) || 'afternoon',
      consecutiveWorkDays: 0,
      offDaysRemaining: weekOffEntitlement,
      lastShiftType: null,
      pendingNightTransition: false,
      workDaysInCurrentShift: 0,
    };
  }

  // Count consecutive work days from the end of previous month
  let consecutiveWorkDays = 0;
  let lastWorkShift: ShiftType | null = null;
  let workDaysInCurrentShift = 0;
  
  for (const assignment of memberAssignments) {
    const isWorkShift = ['morning', 'afternoon', 'night', 'general'].includes(assignment.shiftType);
    
    if (isWorkShift) {
      consecutiveWorkDays++;
      if (!lastWorkShift) {
        lastWorkShift = assignment.shiftType;
      }
      if (assignment.shiftType === lastWorkShift) {
        workDaysInCurrentShift++;
      }
    } else {
      break; // Stop counting when we hit an off day
    }
  }

  const lastAssignment = memberAssignments[0];
  const currentShift = (memberRotationState?.current_shift_type as ShiftType) || 
                       lastWorkShift || 
                       'afternoon';

  // Check if transitioning from Morning to Night
  const pendingNightTransition = lastWorkShift === 'morning' && 
    getNextShiftInRotation(lastWorkShift) === 'night';

  return {
    currentShift,
    consecutiveWorkDays,
    offDaysRemaining: weekOffEntitlement,
    lastShiftType: lastAssignment?.shiftType || null,
    pendingNightTransition,
    workDaysInCurrentShift,
  };
}

/**
 * Get next shift in rotation order: afternoon -> morning -> night -> afternoon
 */
function getNextShiftInRotation(currentShift: ShiftType): ShiftType {
  const rotationOrder: ShiftType[] = ['afternoon', 'morning', 'night'];
  const currentIndex = rotationOrder.indexOf(currentShift);
  if (currentIndex === -1) return 'afternoon';
  return rotationOrder[(currentIndex + 1) % 3];
}

/**
 * Check if member needs mandatory rest before night shift
 */
function needsNightShiftRest(state: MemberState, config: AutoAssignmentConfig): boolean {
  // If transitioning to night shift from morning, need rest
  if (state.pendingNightTransition) {
    return true;
  }
  // Check if worked minimum days and next shift is night
  if (state.workDaysInCurrentShift >= MIN_CONSECUTIVE_WORK_DAYS && 
      state.currentShift === 'morning' &&
      getNextShiftInRotation(state.currentShift) === 'night') {
    return true;
  }
  return false;
}

/**
 * Validate rolling 7-day window compliance
 */
function validateRolling7DayCompliance(
  memberId: string,
  date: Date,
  assignments: ShiftAssignment[],
  weekOffEntitlement: 1 | 2
): boolean {
  const startWindow = subDays(date, 6);
  const endWindow = date;
  
  let offDaysInWindow = 0;
  const windowDays = eachDayOfInterval({ start: startWindow, end: endWindow });
  
  for (const day of windowDays) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const assignment = assignments.find(a => a.memberId === memberId && a.date === dateStr);
    if (assignment && !['morning', 'afternoon', 'night', 'general'].includes(assignment.shiftType)) {
      offDaysInWindow++;
    }
  }
  
  return offDaysInWindow >= weekOffEntitlement;
}

// ========================
// MAIN AUTO-ASSIGN FUNCTION
// ========================

/**
 * Auto-assigns shifts based on comprehensive week-off rules:
 * 1. User-level week-off entitlement (1 or 2 days)
 * 2. Work-rest cycle (3-7 consecutive work days)
 * 3. Night shift safety (mandatory rest before night)
 * 4. Month boundary continuity
 * 5. Rolling 7-day compliance
 */
export function autoAssignShifts(
  startDate: Date,
  endDate: Date,
  context: AssignmentContext
): { assignments: ShiftAssignment[]; shortages: ShiftViolation[] } {
  const { 
    teamMembers, 
    rules, 
    datacenters, 
    publicHolidays, 
    leaveRequests,
    config,
    memberRotationStates,
    previousMonthAssignments = [],
  } = context;
  
  const assignments: ShiftAssignment[] = [];
  const shortages: ShiftViolation[] = [];
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Build rotation state lookup
  const rotationStateMap: Record<string, MemberRotationState> = {};
  memberRotationStates.forEach(state => {
    rotationStateMap[state.member_id] = state;
  });
  
  // Initialize member states from previous month
  const memberStates: Record<string, MemberState> = {};
  teamMembers.forEach(member => {
    memberStates[member.id] = calculateMemberStateFromHistory(
      member.id,
      previousMonthAssignments,
      rotationStateMap[member.id],
      getWeekOffEntitlement(member)
    );
  });
  
  // Calculate member offsets for staggering week-offs
  const memberOffsets: Record<string, number> = {};
  teamMembers.forEach((member, index) => {
    memberOffsets[member.id] = index % 7;
  });
  
  // Process each day
  days.forEach((day, dayIndex) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const isPublicHoliday = publicHolidays.includes(dateStr);
    
    // Track daily assignments for validation
    const dayAssignments: Record<string, TeamMember[]> = {
      'morning': [],
      'afternoon': [],
      'night': [],
      'general': [],
      'week-off': [],
      'public-off': [],
      'paid-leave': [],
      'comp-off': [],
      'leave': [],
    };
    
    // Process each team member
    teamMembers.forEach(member => {
      const state = memberStates[member.id];
      const weekOffEntitlement = getWeekOffEntitlement(member);
      const isRotating = ROTATING_DEPARTMENTS.includes(member.department) && 
                         member.role !== 'TL' && 
                         member.role !== 'Manager';
      const isGeneralShiftWorker = member.role === 'TL' || 
                                   member.role === 'Manager' || 
                                   member.role === 'HR' || 
                                   member.role === 'Admin' || 
                                   GENERAL_SHIFT_DEPARTMENTS.includes(member.department);
      
      // Check if on leave
      const onLeave = config.respectLeaves && leaveRequests.some(lr => 
        lr.memberId === member.id &&
        dateStr >= lr.startDate &&
        dateStr <= lr.endDate
      );
      
      if (onLeave) {
        assignments.push({
          id: `auto-${member.id}-${dateStr}`,
          memberId: member.id,
          shiftType: 'paid-leave',
          date: dateStr,
          department: member.department,
        });
        // Leave counts as rest
        state.consecutiveWorkDays = 0;
        state.offDaysRemaining = weekOffEntitlement;
        return;
      }
      
      // Public holiday handling
      if (isPublicHoliday && config.respectPublicHolidays) {
        assignments.push({
          id: `auto-${member.id}-${dateStr}`,
          memberId: member.id,
          shiftType: 'public-off',
          date: dateStr,
          department: member.department,
        });
        // Public holiday counts as rest
        state.consecutiveWorkDays = 0;
        state.offDaysRemaining = weekOffEntitlement;
        return;
      }
      
      // ========================
      // WEEK-OFF DECISION LOGIC
      // ========================
      
      let shouldAssignWeekOff = false;
      
      // Rule 1: MUST give week-off if reached max consecutive work days (HARD LIMIT)
      if (state.consecutiveWorkDays >= MAX_CONSECUTIVE_WORK_DAYS) {
        shouldAssignWeekOff = true;
      }
      
      // Rule 2: Night shift transition safety
      else if (needsNightShiftRest(state, config) && 
               state.consecutiveWorkDays >= MIN_CONSECUTIVE_WORK_DAYS) {
        shouldAssignWeekOff = true;
        state.pendingNightTransition = false;
      }
      
      // Rule 3: Standard pattern (5 work + 2 off) with entitlement
      else if (state.consecutiveWorkDays >= STANDARD_WORK_DAYS && state.offDaysRemaining > 0) {
        shouldAssignWeekOff = true;
      }
      
      // Rule 4: Rolling 7-day compliance check
      else {
        // Look ahead: if we don't give off today, will we violate 7-day rule?
        const currentAssignmentsForMember = assignments.filter(a => a.memberId === member.id);
        if (!validateRolling7DayCompliance(member.id, addDays(day, 1), currentAssignmentsForMember, weekOffEntitlement) &&
            state.consecutiveWorkDays >= MIN_CONSECUTIVE_WORK_DAYS) {
          shouldAssignWeekOff = true;
        }
      }
      
      // ========================
      // ASSIGN SHIFT OR WEEK-OFF
      // ========================
      
      if (shouldAssignWeekOff) {
        assignments.push({
          id: `auto-${member.id}-${dateStr}`,
          memberId: member.id,
          shiftType: 'week-off',
          date: dateStr,
          department: member.department,
        });
        dayAssignments['week-off'].push(member);
        
        // Update state
        state.consecutiveWorkDays = 0;
        state.offDaysRemaining--;
        
        // Reset off entitlement if we've given all offs
        if (state.offDaysRemaining <= 0) {
          state.offDaysRemaining = weekOffEntitlement;
          
          // Check for shift rotation after off days
          if (state.workDaysInCurrentShift >= config.rotationCycleDays) {
            state.currentShift = getNextShiftInRotation(state.currentShift);
            state.workDaysInCurrentShift = 0;
            
            // Check if transitioning to night from morning
            if (state.currentShift === 'night' && state.lastShiftType === 'morning') {
              state.pendingNightTransition = true;
            }
          }
        }
        return;
      }
      
      // WORK SHIFT ASSIGNMENT
      
      // TLs, Managers, HR, Admin get General shift
      if (isGeneralShiftWorker) {
        assignments.push({
          id: `auto-${member.id}-${dateStr}`,
          memberId: member.id,
          shiftType: 'general',
          date: dateStr,
          department: member.department,
        });
        dayAssignments['general'].push(member);
      } else if (isRotating) {
        // Rotating members get shift based on rotation
        const rotationState = rotationStateMap[member.id];
        const cycleStartDate = rotationState 
          ? new Date(rotationState.cycle_start_date)
          : startDate;
        const currentShiftType = state.currentShift || config.shiftSequence[0];
        
        // Calculate shift type
        const memberShiftType = getMemberShiftTypeForDate(
          cycleStartDate,
          day,
          currentShiftType,
          config.rotationCycleDays,
          config.shiftSequence
        ) as ShiftType;
        
        assignments.push({
          id: `auto-${member.id}-${dateStr}`,
          memberId: member.id,
          shiftType: memberShiftType,
          date: dateStr,
          department: member.department,
        });
        dayAssignments[memberShiftType].push(member);
      }
      
      // Update member state
      state.consecutiveWorkDays++;
      state.workDaysInCurrentShift++;
      state.lastShiftType = assignments.find(a => a.memberId === member.id && a.date === dateStr)?.shiftType || null;
    });
    
    // ========================
    // STAFFING VALIDATION
    // ========================
    
    const shiftTypes: ShiftType[] = ['morning', 'afternoon', 'night', 'general'];
    
    for (const shiftType of shiftTypes) {
      const shiftRules = rules.filter(r => 
        r.shift_type === shiftType && 
        r.is_active &&
        ROTATING_DEPARTMENTS.includes(r.department as Department)
      );
      
      for (const rule of shiftRules) {
        const assignedCount = dayAssignments[shiftType].filter(m => {
          if (m.department !== rule.department) return false;
          if (rule.role_filter && !rule.role_filter.includes(m.role)) return false;
          return true;
        }).length;
        
        if (assignedCount < rule.min_count && config.flagShortages) {
          const datacenterName = rule.datacenter_id 
            ? datacenters.find(d => d.id === rule.datacenter_id)?.name 
            : null;
          
          shortages.push({
            type: 'shortage',
            shift_type: shiftType,
            department: rule.department as Department,
            datacenter_id: rule.datacenter_id,
            required: rule.min_count,
            actual: assignedCount,
            date: dateStr,
            message: `${shiftType.toUpperCase()}: ${rule.department}${datacenterName ? ` (${datacenterName})` : ''} - Need ${rule.min_count - assignedCount} more`,
            severity: 'error',
          });
        }
      }
    }
  });
  
  return { assignments, shortages };
}

/**
 * Check if a role is eligible for a shift type
 */
function isEligibleForShift(role: Role, shiftType: ShiftType): boolean {
  const eligible = ROLE_SHIFT_ELIGIBILITY[role] || [];
  return eligible.includes(shiftType);
}

/**
 * Group team members by department
 */
function groupMembersByDepartment(
  teamMembers: TeamMember[]
): Record<string, TeamMember[]> {
  return teamMembers.reduce((acc, member) => {
    if (!acc[member.department]) {
      acc[member.department] = [];
    }
    acc[member.department].push(member);
    return acc;
  }, {} as Record<string, TeamMember[]>);
}

/**
 * Manual override - update a single assignment
 */
export function overrideAssignment(
  assignments: ShiftAssignment[],
  memberId: string,
  date: string,
  newShiftType: ShiftType | null,
  department: Department
): ShiftAssignment[] {
  const filtered = assignments.filter(
    a => !(a.memberId === memberId && a.date === date)
  );
  
  if (newShiftType) {
    filtered.push({
      id: `override-${memberId}-${date}`,
      memberId,
      shiftType: newShiftType,
      date,
      department,
    });
  }
  
  return filtered;
}

/**
 * Initialize rotation state for a member
 */
export function initializeMemberRotationState(
  memberId: string,
  startDate: Date,
  shiftSequence: string[]
): MemberRotationState {
  return {
    id: `new-${memberId}`,
    member_id: memberId,
    current_shift_type: shiftSequence[0],
    cycle_start_date: format(startDate, 'yyyy-MM-dd'),
  };
}

/**
 * Validate roster for rule compliance
 */
export function validateRosterCompliance(
  assignments: ShiftAssignment[],
  teamMembers: TeamMember[]
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  // Group assignments by member
  const memberAssignments: Record<string, ShiftAssignment[]> = {};
  assignments.forEach(a => {
    if (!memberAssignments[a.memberId]) {
      memberAssignments[a.memberId] = [];
    }
    memberAssignments[a.memberId].push(a);
  });
  
  // Validate each member
  for (const member of teamMembers) {
    const memberAsgn = (memberAssignments[member.id] || []).sort((a, b) => a.date.localeCompare(b.date));
    const weekOffEntitlement = getWeekOffEntitlement(member);
    
    let consecutiveWorkDays = 0;
    
    for (let i = 0; i < memberAsgn.length; i++) {
      const isWorkDay = ['morning', 'afternoon', 'night', 'general'].includes(memberAsgn[i].shiftType);
      
      if (isWorkDay) {
        consecutiveWorkDays++;
        
        // Check max consecutive work days
        if (consecutiveWorkDays > MAX_CONSECUTIVE_WORK_DAYS) {
          violations.push(`${member.name}: Exceeded ${MAX_CONSECUTIVE_WORK_DAYS} consecutive work days on ${memberAsgn[i].date}`);
        }
      } else {
        consecutiveWorkDays = 0;
      }
      
      // Check rolling 7-day compliance
      if (i >= 6) {
        const window = memberAsgn.slice(i - 6, i + 1);
        const offDays = window.filter(a => !['morning', 'afternoon', 'night', 'general'].includes(a.shiftType)).length;
        if (offDays < weekOffEntitlement) {
          violations.push(`${member.name}: Missing week-off entitlement in 7-day window ending ${memberAsgn[i].date}`);
        }
      }
    }
  }
  
  return {
    valid: violations.length === 0,
    violations,
  };
}
