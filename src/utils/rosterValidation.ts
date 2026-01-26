import { ShiftAssignment, ShiftType, TeamMember, Department } from '@/types/roster';
import { 
  ShiftValidationResult, 
  ShiftViolation,
  WORK_DAYS_IN_CYCLE,
  OFF_DAYS_IN_CYCLE,
  CYCLE_LENGTH,
  SHIFT_STABILITY_WORK_DAYS,
  SHIFT_ROTATION_ORDER,
  REST_DAYS_BEFORE_NIGHT,
  MIN_WEEKLY_OFFS,
  ROTATING_DEPARTMENTS,
} from '@/types/shiftRules';
import { format, eachDayOfInterval, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';

// =====================================================
// VALIDATION RULE PRIORITY ORDER
// =====================================================
// 1. Work cycle (10 Work + 4 OFF across 2 weeks) - HIGHEST
// 2. Night shift rest rule
// 3. Shift continuity (10 days = 1 work cycle)
// 4. Shift rotation
// 5. Fairness
// 6. Manual overrides - LOWEST

// =====================================================
// RULE 1: CORE WORK CYCLE VALIDATION (10+4)
// =====================================================

/**
 * Validates that a member never works more than 10 consecutive days
 */
export function validateConsecutiveWorkDays(
  memberId: string,
  assignments: ShiftAssignment[],
  memberName?: string
): ShiftViolation[] {
  const violations: ShiftViolation[] = [];
  
  // Get all work shift assignments for this member, sorted by date
  const memberWorkShifts = assignments
    .filter(a => 
      a.memberId === memberId && 
      !['week-off', 'comp-off', 'leave', 'paid-leave', 'public-off'].includes(a.shiftType)
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  if (memberWorkShifts.length === 0) return violations;
  
  let consecutiveCount = 1;
  let streakStart = memberWorkShifts[0].date;
  
  for (let i = 1; i < memberWorkShifts.length; i++) {
    const prevDate = new Date(memberWorkShifts[i - 1].date);
    const currDate = new Date(memberWorkShifts[i].date);
    const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      consecutiveCount++;
    } else {
      // Check if streak exceeded max
      if (consecutiveCount > WORK_DAYS_IN_CYCLE) {
        violations.push({
          type: 'cycle',
          shift_type: 'morning', // placeholder
          department: memberWorkShifts[i - 1].department as Department,
          required: WORK_DAYS_IN_CYCLE,
          actual: consecutiveCount,
          date: streakStart,
          message: `${memberName || memberId}: ${consecutiveCount} consecutive work days (max ${WORK_DAYS_IN_CYCLE}) starting ${format(new Date(streakStart), 'MMM d')}`,
          memberId,
          severity: 'error',
        });
      }
      consecutiveCount = 1;
      streakStart = memberWorkShifts[i].date;
    }
  }
  
  // Check final streak
  if (consecutiveCount > WORK_DAYS_IN_CYCLE) {
    violations.push({
      type: 'cycle',
      shift_type: 'morning',
      department: memberWorkShifts[memberWorkShifts.length - 1].department as Department,
      required: WORK_DAYS_IN_CYCLE,
      actual: consecutiveCount,
      date: streakStart,
      message: `${memberName || memberId}: ${consecutiveCount} consecutive work days (max ${WORK_DAYS_IN_CYCLE}) starting ${format(new Date(streakStart), 'MMM d')}`,
      memberId,
      severity: 'error',
    });
  }
  
  return violations;
}

/**
 * Validates that OFF days are in continuous blocks (at least 2 consecutive)
 */
export function validateOffDayBlocks(
  memberId: string,
  assignments: ShiftAssignment[],
  startDate: Date,
  endDate: Date,
  memberName?: string
): ShiftViolation[] {
  const violations: ShiftViolation[] = [];
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Build a map of dates to their shift type
  const assignmentMap: Record<string, ShiftType | null> = {};
  days.forEach(d => {
    const dateStr = format(d, 'yyyy-MM-dd');
    const assignment = assignments.find(a => a.memberId === memberId && a.date === dateStr);
    assignmentMap[dateStr] = assignment?.shiftType || null;
  });
  
  // Find OFF days and check they come in pairs
  const offDays = days.filter(d => {
    const shift = assignmentMap[format(d, 'yyyy-MM-dd')];
    return shift === 'week-off' || shift === 'comp-off';
  });
  
  // Check each OFF day has an adjacent OFF day
  offDays.forEach(offDay => {
    const prevDay = format(subDays(offDay, 1), 'yyyy-MM-dd');
    const nextDay = format(addDays(offDay, 1), 'yyyy-MM-dd');
    
    const prevIsOff = assignmentMap[prevDay] === 'week-off' || assignmentMap[prevDay] === 'comp-off';
    const nextIsOff = assignmentMap[nextDay] === 'week-off' || assignmentMap[nextDay] === 'comp-off';
    
    if (!prevIsOff && !nextIsOff) {
      // Check if prev/next are even in our range
      if (days.some(d => format(d, 'yyyy-MM-dd') === prevDay) || 
          days.some(d => format(d, 'yyyy-MM-dd') === nextDay)) {
        violations.push({
          type: 'cycle',
          shift_type: 'week-off',
          department: 'Support' as Department, // placeholder
          required: 2,
          actual: 1,
          date: format(offDay, 'yyyy-MM-dd'),
          message: `${memberName || memberId}: Single OFF day on ${format(offDay, 'MMM d')} (must be 2 consecutive)`,
          memberId,
          severity: 'error',
        });
      }
    }
  });
  
  return violations;
}

/**
 * Validates that a member has EXACTLY 2 week-offs per week (compulsory)
 */
export function validateWeeklyOffs(
  memberId: string,
  assignments: ShiftAssignment[],
  startDate: Date,
  endDate: Date,
  memberName?: string
): ShiftViolation[] {
  const violations: ShiftViolation[] = [];
  
  // Get all weeks in the period
  let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday start
  
  while (currentWeekStart <= endDate) {
    const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ 
      start: currentWeekStart < startDate ? startDate : currentWeekStart, 
      end: currentWeekEnd > endDate ? endDate : currentWeekEnd 
    });
    
    // Only validate full weeks (7 days) or partial weeks with sufficient days
    if (weekDays.length >= 5) {
      // Count week-offs in this week
      const weekOffCount = weekDays.filter(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const assignment = assignments.find(a => a.memberId === memberId && a.date === dateStr);
        return assignment && ['week-off', 'comp-off'].includes(assignment.shiftType);
      }).length;
      
      if (weekOffCount < MIN_WEEKLY_OFFS) {
        violations.push({
          type: 'cycle',
          shift_type: 'week-off',
          department: 'Support' as Department,
          required: MIN_WEEKLY_OFFS,
          actual: weekOffCount,
          date: format(currentWeekStart, 'yyyy-MM-dd'),
          message: `${memberName || memberId}: Only ${weekOffCount} week-off(s) in week of ${format(currentWeekStart, 'MMM d')} (must have ${MIN_WEEKLY_OFFS} compulsory)`,
          memberId,
          severity: 'error',
        });
      }
    }
    
    currentWeekStart = addDays(currentWeekStart, 7);
  }
  
  return violations;
}

/**
 * Validates that a member has required OFF days (not zero)
 */
export function validateMinimumOffDays(
  memberId: string,
  assignments: ShiftAssignment[],
  startDate: Date,
  endDate: Date,
  memberName?: string
): ShiftViolation[] {
  const violations: ShiftViolation[] = [];
  
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const totalDays = days.length;
  
  // Expected OFF days: 2 per 7 days
  const expectedOffDays = Math.floor(totalDays / CYCLE_LENGTH) * OFF_DAYS_IN_CYCLE;
  
  const memberOffs = assignments.filter(a => 
    a.memberId === memberId && 
    (a.shiftType === 'week-off' || a.shiftType === 'comp-off')
  );
  
  if (memberOffs.length === 0) {
    violations.push({
      type: 'cycle',
      shift_type: 'week-off',
      department: 'Support' as Department,
      required: expectedOffDays,
      actual: 0,
      date: format(startDate, 'yyyy-MM-dd'),
      message: `${memberName || memberId}: Has 0 OFF days in the period (expected ~${expectedOffDays})`,
      memberId,
      severity: 'error',
    });
  }
  
  return violations;
}

// =====================================================
// RULE 2: NIGHT SHIFT TRANSITION SAFETY
// =====================================================

/**
 * Validates that members get required rest (1-2 days) before starting night shift
 */
export function validateNightShiftTransition(
  memberId: string,
  assignments: ShiftAssignment[],
  memberName?: string
): ShiftViolation[] {
  const violations: ShiftViolation[] = [];
  
  // Sort assignments by date
  const sortedAssignments = assignments
    .filter(a => a.memberId === memberId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  for (let i = 0; i < sortedAssignments.length; i++) {
    const curr = sortedAssignments[i];
    
    // Check if this is a night shift
    if (curr.shiftType === 'night') {
      const currDate = new Date(curr.date);
      
      // Look back to find rest days before this night shift
      let restDaysBeforeNight = 0;
      
      for (let j = i - 1; j >= 0; j--) {
        const prev = sortedAssignments[j];
        const prevDate = new Date(prev.date);
        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > 3) break; // Only check last 3 days
        
        if (['week-off', 'comp-off', 'leave', 'paid-leave', 'public-off'].includes(prev.shiftType)) {
          restDaysBeforeNight++;
        } else if (['morning', 'afternoon'].includes(prev.shiftType)) {
          // Found a non-rest day, check if we have enough rest
          if (restDaysBeforeNight < REST_DAYS_BEFORE_NIGHT) {
            violations.push({
              type: 'night-safety',
              shift_type: 'night',
              department: curr.department as Department,
              required: REST_DAYS_BEFORE_NIGHT,
              actual: restDaysBeforeNight,
              date: curr.date,
              message: `${memberName || memberId}: Transition to Night on ${format(currDate, 'MMM d')} with only ${restDaysBeforeNight} rest day(s) (need ${REST_DAYS_BEFORE_NIGHT}-2 days rest)`,
              memberId,
              severity: 'error',
            });
          }
          break;
        }
      }
    }
  }
  
  return violations;
}

// =====================================================
// RULE 3: SHIFT STABILITY (10 WORKING DAYS)
// =====================================================

/**
 * Validates that a member stays on the same shift for 10 working days
 */
export function validateShiftStability(
  memberId: string,
  assignments: ShiftAssignment[],
  memberName?: string
): ShiftViolation[] {
  const violations: ShiftViolation[] = [];
  
  // Get work shifts only (exclude offs and leaves)
  const workShifts = assignments
    .filter(a => 
      a.memberId === memberId && 
      ['morning', 'afternoon', 'night'].includes(a.shiftType)
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  if (workShifts.length < 2) return violations;
  
  let currentShift = workShifts[0].shiftType;
  let consecutiveCount = 1;
  let streakStart = workShifts[0].date;
  
  for (let i = 1; i < workShifts.length; i++) {
    if (workShifts[i].shiftType === currentShift) {
      consecutiveCount++;
    } else {
      // Shift changed - check if we had at least 10 work days
      if (consecutiveCount < SHIFT_STABILITY_WORK_DAYS) {
        violations.push({
          type: 'stability',
          shift_type: currentShift,
          department: workShifts[i - 1].department as Department,
          required: SHIFT_STABILITY_WORK_DAYS,
          actual: consecutiveCount,
          date: streakStart,
          message: `${memberName || memberId}: Only ${consecutiveCount} work days on ${currentShift} (min ${SHIFT_STABILITY_WORK_DAYS}) before changing to ${workShifts[i].shiftType}`,
          memberId,
          severity: 'warning', // Warning since shift cycle might span months
        });
      }
      
      currentShift = workShifts[i].shiftType;
      consecutiveCount = 1;
      streakStart = workShifts[i].date;
    }
  }
  
  return violations;
}

// =====================================================
// RULE 4: SHIFT ROTATION ORDER
// =====================================================

/**
 * Validates shift rotation follows: Afternoon → Morning → Night
 */
export function validateShiftRotationOrder(
  memberId: string,
  assignments: ShiftAssignment[],
  memberName?: string
): ShiftViolation[] {
  const violations: ShiftViolation[] = [];
  
  const workShifts = assignments
    .filter(a => 
      a.memberId === memberId && 
      ['morning', 'afternoon', 'night'].includes(a.shiftType)
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  if (workShifts.length < 2) return violations;
  
  let lastShift = workShifts[0].shiftType as ShiftType;
  
  for (let i = 1; i < workShifts.length; i++) {
    const currShift = workShifts[i].shiftType as ShiftType;
    
    if (currShift !== lastShift && ['morning', 'afternoon', 'night'].includes(currShift)) {
      // Check if this is a valid rotation
      const expectedNextIndex = (SHIFT_ROTATION_ORDER.indexOf(lastShift) + 1) % SHIFT_ROTATION_ORDER.length;
      const expectedNextShift = SHIFT_ROTATION_ORDER[expectedNextIndex];
      
      if (currShift !== expectedNextShift) {
        violations.push({
          type: 'constraint',
          shift_type: currShift,
          department: workShifts[i].department as Department,
          required: 0,
          actual: 0,
          date: workShifts[i].date,
          message: `${memberName || memberId}: Invalid rotation from ${lastShift} to ${currShift} on ${format(new Date(workShifts[i].date), 'MMM d')} (expected ${expectedNextShift})`,
          memberId,
          severity: 'warning',
        });
      }
      
      lastShift = currShift;
    }
  }
  
  return violations;
}

// =====================================================
// COMPREHENSIVE ROSTER VALIDATION
// =====================================================

/**
 * Validates entire roster against all rules
 * Returns violations sorted by priority
 */
export function validateRoster(
  assignments: ShiftAssignment[],
  teamMembers: TeamMember[],
  startDate: Date,
  endDate: Date
): ShiftValidationResult {
  const allViolations: ShiftViolation[] = [];
  const allWarnings: ShiftViolation[] = [];
  
  // Get rotating members only
  const rotatingMembers = teamMembers.filter(m => 
    ROTATING_DEPARTMENTS.includes(m.department as any) && 
    m.role !== 'TL'
  );
  
  rotatingMembers.forEach(member => {
    // Rule 1: Work cycle validation - Compulsory 2 week-offs per week
    const consecutiveViolations = validateConsecutiveWorkDays(member.id, assignments, member.name);
    const offBlockViolations = validateOffDayBlocks(member.id, assignments, startDate, endDate, member.name);
    const minOffViolations = validateMinimumOffDays(member.id, assignments, startDate, endDate, member.name);
    const weeklyOffViolations = validateWeeklyOffs(member.id, assignments, startDate, endDate, member.name);
    
    // Rule 2: Night shift safety - 1-2 days rest before night shift
    const nightSafetyViolations = validateNightShiftTransition(member.id, assignments, member.name);
    
    // Rule 3: Shift stability
    const stabilityViolations = validateShiftStability(member.id, assignments, member.name);
    
    // Rule 4: Rotation order
    const rotationViolations = validateShiftRotationOrder(member.id, assignments, member.name);
    
    // Categorize by severity
    [
      ...consecutiveViolations,
      ...offBlockViolations,
      ...minOffViolations,
      ...weeklyOffViolations,
      ...nightSafetyViolations,
      ...stabilityViolations,
      ...rotationViolations,
    ].forEach(v => {
      if (v.severity === 'error') {
        allViolations.push(v);
      } else {
        allWarnings.push(v);
      }
    });
  });
  
  // Remove duplicate violations (same member, same date, same type)
  const uniqueViolations = allViolations.filter((v, index, self) =>
    index === self.findIndex(t => 
      t.memberId === v.memberId && 
      t.date === v.date && 
      t.type === v.type
    )
  );
  
  const uniqueWarnings = allWarnings.filter((v, index, self) =>
    index === self.findIndex(t => 
      t.memberId === v.memberId && 
      t.date === v.date && 
      t.type === v.type
    )
  );
  
  return {
    isValid: uniqueViolations.length === 0,
    violations: uniqueViolations,
    warnings: uniqueWarnings,
  };
}

/**
 * Auto-fix roster violations by inserting OFF days or adjusting shifts
 */
export function autoFixRosterViolations(
  assignments: ShiftAssignment[],
  teamMembers: TeamMember[],
  startDate: Date,
  endDate: Date
): ShiftAssignment[] {
  let fixedAssignments = [...assignments];
  
  const rotatingMembers = teamMembers.filter(m => 
    ROTATING_DEPARTMENTS.includes(m.department as any) && 
    m.role !== 'TL'
  );
  
  rotatingMembers.forEach(member => {
    // Fix consecutive work days by inserting OFF days
    const memberAssignments = fixedAssignments
      .filter(a => a.memberId === member.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let consecutiveCount = 0;
    
    memberAssignments.forEach((assignment, index) => {
      const isWorkShift = !['week-off', 'comp-off', 'leave', 'paid-leave', 'public-off'].includes(assignment.shiftType);
      
      if (isWorkShift) {
        consecutiveCount++;
        
        // If we've hit 5 consecutive work days, force next 2 to be OFF
        if (consecutiveCount >= WORK_DAYS_IN_CYCLE) {
          // Mark next 2 days as week-off
          for (let j = 1; j <= OFF_DAYS_IN_CYCLE; j++) {
            if (index + j < memberAssignments.length) {
              const nextAssignment = memberAssignments[index + j];
              const existingIndex = fixedAssignments.findIndex(
                a => a.memberId === member.id && a.date === nextAssignment.date
              );
              
              if (existingIndex !== -1) {
                fixedAssignments[existingIndex] = {
                  ...fixedAssignments[existingIndex],
                  shiftType: 'week-off',
                };
              }
            }
          }
          consecutiveCount = 0;
        }
      } else {
        consecutiveCount = 0;
      }
    });
  });
  
  return fixedAssignments;
}
