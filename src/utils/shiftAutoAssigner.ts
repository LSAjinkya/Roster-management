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
import { format, eachDayOfInterval, differenceInDays } from 'date-fns';

interface MemberHistory {
  lastShiftType: ShiftType | null;
  consecutiveNights: number;
  lastShiftDate: string | null;
  totalShifts: number;
  shiftCounts: Record<ShiftType, number>;
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
}

/**
 * Auto-assigns shifts based on 15-day rotation cycles
 * Each member stays on ONE shift type for the full 15 days, then rotates
 * Week-offs follow 2+2 pattern (2 offs per week)
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
  } = context;
  
  const assignments: ShiftAssignment[] = [];
  const shortages: ShiftViolation[] = [];
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Build rotation state lookup
  const rotationStateMap: Record<string, MemberRotationState> = {};
  memberRotationStates.forEach(state => {
    rotationStateMap[state.member_id] = state;
  });
  
  // Filter to only rotating department members (non-TL)
  const rotatingMembers = teamMembers.filter(m => 
    ROTATING_DEPARTMENTS.includes(m.department) &&
    m.role !== 'TL'
  );
  
  // Calculate member offsets for staggering week-offs
  const memberOffsets: Record<string, number> = {};
  rotatingMembers.forEach((member, index) => {
    memberOffsets[member.id] = index % 7; // Stagger across week
  });
  
  // Process each day
  days.forEach((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const isPublicHoliday = publicHolidays.includes(dateStr);
    
    // Track who is available and who gets which shift
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
      const isRotating = ROTATING_DEPARTMENTS.includes(member.department) && member.role !== 'TL';
      
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
        return;
      }
      
      // TLs and Vendor Coordinator get General shift
      if (member.role === 'TL' || GENERAL_SHIFT_DEPARTMENTS.includes(member.department)) {
        assignments.push({
          id: `auto-${member.id}-${dateStr}`,
          memberId: member.id,
          shiftType: 'general',
          date: dateStr,
          department: member.department,
        });
        dayAssignments['general'].push(member);
        return;
      }
      
      // For rotating members, check week-off and determine shift
      if (isRotating) {
        const rotationState = rotationStateMap[member.id];
        const cycleStartDate = rotationState 
          ? new Date(rotationState.cycle_start_date)
          : startDate;
        const currentShiftType = rotationState?.current_shift_type || config.shiftSequence[0];
        
        // Calculate which shift type this member should be on
        const memberShiftType = getMemberShiftTypeForDate(
          cycleStartDate,
          day,
          currentShiftType,
          config.rotationCycleDays,
          config.shiftSequence
        ) as ShiftType;
        
        // Calculate day within current cycle
        const daysSinceCycleStart = Math.floor(
          (day.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const dayInCycle = ((daysSinceCycleStart % config.rotationCycleDays) + config.rotationCycleDays) % config.rotationCycleDays;
        
        // Get this member's week-off days
        const memberOffset = memberOffsets[member.id] || 0;
        const weekOffDays = getWeekOffDaysInCycle(
          cycleStartDate,
          memberOffset,
          config.rotationCycleDays
        );
        
        // Check if today is a week-off day for this member
        if (weekOffDays.includes(dayInCycle)) {
          assignments.push({
            id: `auto-${member.id}-${dateStr}`,
            memberId: member.id,
            shiftType: 'week-off',
            date: dateStr,
            department: member.department,
          });
          dayAssignments['week-off'].push(member);
          return;
        }
        
        // Assign the calculated shift type
        assignments.push({
          id: `auto-${member.id}-${dateStr}`,
          memberId: member.id,
          shiftType: memberShiftType,
          date: dateStr,
          department: member.department,
        });
        dayAssignments[memberShiftType].push(member);
      }
    });
    
    // Validate staffing against composition rules
    const shiftTypes: ShiftType[] = ['morning', 'afternoon', 'night'];
    
    for (const shiftType of shiftTypes) {
      const shiftRules = rules.filter(r => 
        r.shift_type === shiftType && 
        r.is_active &&
        ROTATING_DEPARTMENTS.includes(r.department as Department)
      );
      
      for (const rule of shiftRules) {
        // Count assigned members for this department and shift
        const assignedCount = dayAssignments[shiftType].filter(m => {
          if (m.department !== rule.department) return false;
          if (rule.role_filter && !rule.role_filter.includes(m.role)) return false;
          return true;
        }).length;
        
        // Flag shortage if not enough assigned
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
  // Remove existing assignment for this member/date
  const filtered = assignments.filter(
    a => !(a.memberId === memberId && a.date === date)
  );
  
  // Add new assignment if not null
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