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
}

/**
 * Auto-assigns shifts based on rules, eligibility, and history
 * Returns assignments and any shortages that couldn't be filled
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
    existingAssignments,
    config 
  } = context;
  
  const assignments: ShiftAssignment[] = [];
  const shortages: ShiftViolation[] = [];
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Track member history for rotation
  const memberHistory: Record<string, MemberHistory> = {};
  teamMembers.forEach(m => {
    memberHistory[m.id] = {
      lastShiftType: null,
      consecutiveNights: 0,
      lastShiftDate: null,
      totalShifts: 0,
      shiftCounts: {} as Record<ShiftType, number>,
    };
  });
  
  // Pre-compute member availability
  const memberAvailability = computeMemberAvailability(
    teamMembers,
    days,
    publicHolidays,
    leaveRequests,
    config
  );
  
  // Process each day
  days.forEach((day, dayIndex) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const isPublicHoliday = publicHolidays.includes(dateStr);
    
    // Assign public holidays
    if (isPublicHoliday && config.respectPublicHolidays) {
      teamMembers.forEach(member => {
        assignments.push({
          id: `auto-${member.id}-${dateStr}`,
          memberId: member.id,
          shiftType: 'public-off',
          date: dateStr,
          department: member.department,
        });
      });
      return;
    }
    
    // Group members by department
    const membersByDept = groupMembersByDepartment(teamMembers);
    
    // Get available members for this day
    const availableMembers = new Set<string>();
    teamMembers.forEach(m => {
      const avail = memberAvailability.find(
        a => a.memberId === m.id && a.date === dateStr
      );
      if (!avail || avail.isAvailable) {
        availableMembers.add(m.id);
      }
    });
    
    // Assign week-offs first (5+2 pattern)
    const weekOffMembers = assignWeekOffs(
      teamMembers,
      dayIndex,
      config.work_days || 5,
      config.off_days || 2
    );
    
    weekOffMembers.forEach(memberId => {
      if (availableMembers.has(memberId)) {
        availableMembers.delete(memberId);
        const member = teamMembers.find(m => m.id === memberId);
        if (member) {
          assignments.push({
            id: `auto-${memberId}-${dateStr}`,
            memberId,
            shiftType: 'week-off',
            date: dateStr,
            department: member.department,
          });
        }
      }
    });
    
    // Assign shifts based on composition rules
    const shiftTypes: ShiftType[] = ['morning', 'afternoon', 'night'];
    
    for (const shiftType of shiftTypes) {
      const shiftRules = rules.filter(r => 
        r.shift_type === shiftType && 
        r.is_active &&
        ROTATING_DEPARTMENTS.includes(r.department as Department)
      );
      
      for (const rule of shiftRules) {
        const departmentMembers = membersByDept[rule.department] || [];
        const eligibleMembers = departmentMembers.filter(m => {
          // Check availability
          if (!availableMembers.has(m.id)) return false;
          
          // Check role eligibility
          if (!isEligibleForShift(m.role, shiftType)) return false;
          
          // Check role filter
          if (rule.role_filter && !rule.role_filter.includes(m.role)) return false;
          
          // Check datacenter match for Infra
          if (rule.datacenter_id && rule.department === 'Infra') {
            // Would need datacenter_id on member
          }
          
          // Check consecutive nights constraint
          if (shiftType === 'night') {
            const history = memberHistory[m.id];
            if (history.consecutiveNights >= config.maxConsecutiveNights) {
              return false;
            }
          }
          
          return true;
        });
        
        // Sort by least shifts assigned (for fairness)
        eligibleMembers.sort((a, b) => {
          const aCount = memberHistory[a.id].totalShifts;
          const bCount = memberHistory[b.id].totalShifts;
          return aCount - bCount;
        });
        
        // Assign up to min_count members
        const assignedCount = Math.min(eligibleMembers.length, rule.min_count);
        
        for (let i = 0; i < assignedCount; i++) {
          const member = eligibleMembers[i];
          availableMembers.delete(member.id);
          
          assignments.push({
            id: `auto-${member.id}-${dateStr}`,
            memberId: member.id,
            shiftType,
            date: dateStr,
            department: member.department,
          });
          
          // Update history
          const history = memberHistory[member.id];
          history.lastShiftType = shiftType;
          history.lastShiftDate = dateStr;
          history.totalShifts++;
          history.shiftCounts[shiftType] = (history.shiftCounts[shiftType] || 0) + 1;
          
          if (shiftType === 'night') {
            history.consecutiveNights++;
          } else {
            history.consecutiveNights = 0;
          }
        }
        
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
          });
        }
      }
    }
    
    // Assign General shift to TLs and Vendor Coordinator
    GENERAL_SHIFT_DEPARTMENTS.forEach(dept => {
      const deptMembers = membersByDept[dept] || [];
      deptMembers.forEach(member => {
        if (availableMembers.has(member.id)) {
          availableMembers.delete(member.id);
          assignments.push({
            id: `auto-${member.id}-${dateStr}`,
            memberId: member.id,
            shiftType: 'general',
            date: dateStr,
            department: member.department,
          });
        }
      });
    });
    
    // Assign TLs from rotating departments to General shift
    teamMembers
      .filter(m => m.role === 'TL' && ROTATING_DEPARTMENTS.includes(m.department))
      .forEach(member => {
        if (availableMembers.has(member.id)) {
          availableMembers.delete(member.id);
          assignments.push({
            id: `auto-${member.id}-${dateStr}`,
            memberId: member.id,
            shiftType: 'general',
            date: dateStr,
            department: member.department,
          });
        }
      });
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
 * Compute member availability for all days
 */
function computeMemberAvailability(
  teamMembers: TeamMember[],
  days: Date[],
  publicHolidays: string[],
  leaveRequests: { memberId: string; startDate: string; endDate: string }[],
  config: AutoAssignmentConfig
): { memberId: string; date: string; isAvailable: boolean; reason?: string }[] {
  const availability: { memberId: string; date: string; isAvailable: boolean; reason?: string }[] = [];
  
  teamMembers.forEach(member => {
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      let isAvailable = member.status === 'available';
      let reason: string | undefined;
      
      // Check leave requests
      if (config.respectLeaves) {
        const onLeave = leaveRequests.some(lr => 
          lr.memberId === member.id &&
          dateStr >= lr.startDate &&
          dateStr <= lr.endDate
        );
        if (onLeave) {
          isAvailable = false;
          reason = 'leave';
        }
      }
      
      // Check public holidays
      if (config.respectPublicHolidays && publicHolidays.includes(dateStr)) {
        isAvailable = false;
        reason = 'public-off';
      }
      
      availability.push({
        memberId: member.id,
        date: dateStr,
        isAvailable,
        reason,
      });
    });
  });
  
  return availability;
}

/**
 * Determine which members get week-off on a given day index
 * Uses rotating 5+2 pattern staggered across team
 */
function assignWeekOffs(
  teamMembers: TeamMember[],
  dayIndex: number,
  workDays: number,
  offDays: number
): string[] {
  const cycleLength = workDays + offDays;
  const weekOffMembers: string[] = [];
  
  // Filter to only rotating department members
  const rotatingMembers = teamMembers.filter(m => 
    ROTATING_DEPARTMENTS.includes(m.department) &&
    m.role !== 'TL'
  );
  
  rotatingMembers.forEach((member, memberIndex) => {
    // Stagger week-offs so not everyone is off same days
    const memberOffset = (memberIndex * offDays) % cycleLength;
    const adjustedDayIndex = (dayIndex + memberOffset) % cycleLength;
    
    // Off days are at the end of each cycle
    if (adjustedDayIndex >= workDays) {
      weekOffMembers.push(member.id);
    }
  });
  
  return weekOffMembers;
}

/**
 * Manual override - update a single assignment
 */
export function overrideAssignment(
  assignments: ShiftAssignment[],
  memberId: string,
  date: string,
  newShiftType: ShiftType | null
): ShiftAssignment[] {
  // Remove existing assignment for this member/date
  const filtered = assignments.filter(
    a => !(a.memberId === memberId && a.date === date)
  );
  
  // Add new assignment if not null
  if (newShiftType) {
    // We'd need to find the member to get department
    // This is a simplified version
    filtered.push({
      id: `override-${memberId}-${date}`,
      memberId,
      shiftType: newShiftType,
      date,
      department: 'Support', // Would need proper lookup
    });
  }
  
  return filtered;
}
