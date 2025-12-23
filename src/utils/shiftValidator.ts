import { ShiftAssignment, ShiftType, TeamMember, Department } from '@/types/roster';
import { 
  ShiftCompositionRule, 
  ShiftValidationResult, 
  ShiftViolation,
  Datacenter 
} from '@/types/shiftRules';
import { format } from 'date-fns';

/**
 * Validates shift assignments against composition rules
 */
export function validateShiftComposition(
  assignments: ShiftAssignment[],
  teamMembers: TeamMember[],
  rules: ShiftCompositionRule[],
  datacenters: Datacenter[],
  date: string
): ShiftValidationResult {
  const violations: ShiftViolation[] = [];
  const warnings: ShiftViolation[] = [];
  
  // Get assignments for this date
  const dateAssignments = assignments.filter(a => a.date === date);
  
  // Get active rules
  const activeRules = rules.filter(r => r.is_active);
  
  // Check each rule
  for (const rule of activeRules) {
    const matchingAssignments = dateAssignments.filter(a => {
      // Match shift type
      if (a.shiftType !== rule.shift_type) return false;
      
      // Match department
      if (a.department !== rule.department) return false;
      
      // Match datacenter if specified
      if (rule.datacenter_id) {
        const member = teamMembers.find(m => m.id === a.memberId);
        // For now we check datacenter via member's datacenter_id
        // This would require extending TeamMember type
      }
      
      // Match role filter if specified
      if (rule.role_filter && rule.role_filter.length > 0) {
        const member = teamMembers.find(m => m.id === a.memberId);
        if (!member || !rule.role_filter.includes(member.role)) {
          return false;
        }
      }
      
      return true;
    });
    
    const actualCount = matchingAssignments.length;
    const requiredCount = rule.min_count;
    
    if (actualCount < requiredCount) {
      const datacenterName = rule.datacenter_id 
        ? datacenters.find(d => d.id === rule.datacenter_id)?.name || 'Unknown DC'
        : null;
      
      const roleInfo = rule.role_filter?.join('/') || 'any role';
      const dcInfo = datacenterName ? ` (${datacenterName})` : '';
      
      const shortage = requiredCount - actualCount;
      
      violations.push({
        type: 'shortage',
        shift_type: rule.shift_type as ShiftType,
        department: rule.department as Department,
        datacenter_id: rule.datacenter_id,
        required: requiredCount,
        actual: actualCount,
        date,
        message: `${rule.shift_type.toUpperCase()}: ${rule.department}${dcInfo} needs ${shortage} more ${roleInfo} (${actualCount}/${requiredCount})`,
        severity: 'error',
      });
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * Validates a full month of assignments
 */
export function validateMonthlyRoster(
  assignments: ShiftAssignment[],
  teamMembers: TeamMember[],
  rules: ShiftCompositionRule[],
  datacenters: Datacenter[],
  startDate: Date,
  endDate: Date
): { dateResults: Record<string, ShiftValidationResult>; summary: ShiftValidationResult } {
  const dateResults: Record<string, ShiftValidationResult> = {};
  const allViolations: ShiftViolation[] = [];
  const allWarnings: ShiftViolation[] = [];
  
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const result = validateShiftComposition(
      assignments,
      teamMembers,
      rules,
      datacenters,
      dateStr
    );
    
    dateResults[dateStr] = result;
    allViolations.push(...result.violations);
    allWarnings.push(...result.warnings);
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return {
    dateResults,
    summary: {
      isValid: allViolations.length === 0,
      violations: allViolations,
      warnings: allWarnings,
    },
  };
}

/**
 * Checks consecutive night shift constraint
 */
export function checkConsecutiveNights(
  memberId: string,
  assignments: ShiftAssignment[],
  maxConsecutive: number
): { valid: boolean; count: number } {
  const memberAssignments = assignments
    .filter(a => a.memberId === memberId && a.shiftType === 'night')
    .map(a => new Date(a.date))
    .sort((a, b) => a.getTime() - b.getTime());
  
  if (memberAssignments.length === 0) {
    return { valid: true, count: 0 };
  }
  
  let maxStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < memberAssignments.length; i++) {
    const diff = memberAssignments[i].getTime() - memberAssignments[i - 1].getTime();
    const daysDiff = diff / (1000 * 60 * 60 * 24);
    
    if (daysDiff === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  return {
    valid: maxStreak <= maxConsecutive,
    count: maxStreak,
  };
}

/**
 * Checks minimum rest hours between shifts
 */
export function checkRestHours(
  memberId: string,
  assignments: ShiftAssignment[],
  minRestHours: number
): { valid: boolean; violations: string[] } {
  const memberAssignments = assignments
    .filter(a => a.memberId === memberId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const violations: string[] = [];
  
  // Simplified check - in real implementation would need shift end/start times
  // For now, check if night shift is followed by morning shift next day
  for (let i = 0; i < memberAssignments.length - 1; i++) {
    const current = memberAssignments[i];
    const next = memberAssignments[i + 1];
    
    const currentDate = new Date(current.date);
    const nextDate = new Date(next.date);
    const daysDiff = (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Night (21:00-07:00) followed by Morning (07:00-16:00) same day = 0 hours rest
    if (daysDiff === 1 && current.shiftType === 'night' && next.shiftType === 'morning') {
      violations.push(`${format(nextDate, 'MMM d')}: Night to Morning with insufficient rest`);
    }
  }
  
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Gets summary statistics for a roster
 */
export function getRosterStats(
  assignments: ShiftAssignment[],
  teamMembers: TeamMember[]
): {
  totalAssignments: number;
  byShift: Record<string, number>;
  byDepartment: Record<string, number>;
  memberStats: Record<string, { shifts: number; nights: number; weekOffs: number }>;
} {
  const byShift: Record<string, number> = {};
  const byDepartment: Record<string, number> = {};
  const memberStats: Record<string, { shifts: number; nights: number; weekOffs: number }> = {};
  
  // Initialize member stats
  teamMembers.forEach(m => {
    memberStats[m.id] = { shifts: 0, nights: 0, weekOffs: 0 };
  });
  
  assignments.forEach(a => {
    // By shift type
    byShift[a.shiftType] = (byShift[a.shiftType] || 0) + 1;
    
    // By department
    byDepartment[a.department] = (byDepartment[a.department] || 0) + 1;
    
    // Member stats
    if (memberStats[a.memberId]) {
      if (a.shiftType === 'week-off' || a.shiftType === 'comp-off') {
        memberStats[a.memberId].weekOffs++;
      } else if (a.shiftType !== 'leave' && a.shiftType !== 'public-off') {
        memberStats[a.memberId].shifts++;
        if (a.shiftType === 'night') {
          memberStats[a.memberId].nights++;
        }
      }
    }
  });
  
  return {
    totalAssignments: assignments.length,
    byShift,
    byDepartment,
    memberStats,
  };
}
