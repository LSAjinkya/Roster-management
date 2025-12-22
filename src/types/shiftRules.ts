import { ShiftType, Department, Role } from './roster';

export interface Datacenter {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface ShiftCompositionRule {
  id: string;
  shift_type: ShiftType;
  department: Department;
  datacenter_id: string | null;
  min_count: number;
  role_filter: Role[] | null;
  is_active: boolean;
}

export interface RotationConfig {
  id: string;
  rotation_cycle_days: number;
  max_consecutive_nights: number;
  min_rest_hours: number;
  work_days: number;
  off_days: number;
  is_active: boolean;
  shift_sequence: string[]; // e.g., ['afternoon', 'morning', 'night']
}

export interface MemberRotationState {
  id: string;
  member_id: string;
  current_shift_type: string;
  cycle_start_date: string;
}

export interface ShiftViolation {
  type: 'shortage' | 'constraint' | 'rest';
  shift_type: ShiftType;
  department: Department;
  datacenter_id?: string | null;
  required: number;
  actual: number;
  date: string;
  message: string;
}

export interface ShiftValidationResult {
  isValid: boolean;
  violations: ShiftViolation[];
  warnings: ShiftViolation[];
}

export interface MemberAvailability {
  memberId: string;
  date: string;
  isAvailable: boolean;
  reason?: 'leave' | 'comp-off' | 'week-off' | 'public-off' | 'unavailable';
}

export interface AutoAssignmentConfig {
  respectWeeklyOffs: boolean;
  respectLeaves: boolean;
  respectPublicHolidays: boolean;
  maxConsecutiveNights: number;
  minRestHours: number;
  rotationCycleDays: number;
  work_days: number;
  off_days: number;
  flagShortages: boolean;
  shiftSequence: string[]; // Shift rotation order
}

export const DEFAULT_ASSIGNMENT_CONFIG: AutoAssignmentConfig = {
  respectWeeklyOffs: true,
  respectLeaves: true,
  respectPublicHolidays: true,
  work_days: 5,
  off_days: 2,
  maxConsecutiveNights: 5,
  minRestHours: 12,
  rotationCycleDays: 15,
  flagShortages: true,
  shiftSequence: ['afternoon', 'morning', 'night'],
};

// Calculate which shift type a member should be on for a given date
export function getMemberShiftTypeForDate(
  cycleStartDate: Date,
  targetDate: Date,
  currentShiftType: string,
  rotationCycleDays: number,
  shiftSequence: string[]
): string {
  const daysDiff = Math.floor((targetDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const cyclesPassed = Math.floor(daysDiff / rotationCycleDays);
  
  const currentIndex = shiftSequence.indexOf(currentShiftType);
  if (currentIndex === -1) return shiftSequence[0];
  
  const newIndex = (currentIndex + cyclesPassed) % shiftSequence.length;
  return shiftSequence[newIndex];
}

// Get week-off days within a 7-day work cycle
// Pattern: 5 consecutive working days, then 2 consecutive off days
// Member offset staggers which day their cycle starts
export function getWeekOffDaysInCycle(
  cycleStartDate: Date,
  memberOffset: number,
  rotationCycleDays: number
): number[] {
  const offDays: number[] = [];
  
  // Each member has a 7-day pattern: 5 work + 2 off
  // The offset determines where in the week their 2 off days fall
  // Offset 0: off on days 5,6 (Sat, Sun if starting Monday)
  // Offset 1: off on days 6,0 (Sun, Mon)
  // Offset 2: off on days 0,1 (Mon, Tue)
  // etc.
  
  const offStartDay = (5 + memberOffset) % 7; // Which day of week the 2-day off block starts
  
  // Calculate off days for the entire cycle period
  for (let week = 0; week < Math.ceil(rotationCycleDays / 7); week++) {
    const weekStart = week * 7;
    
    // First off day of this week
    const firstOff = weekStart + offStartDay;
    // Second off day (consecutive)
    const secondOff = weekStart + ((offStartDay + 1) % 7);
    
    // Handle wrap-around: if second off would be before first, adjust
    const actualSecondOff = secondOff < firstOff ? firstOff + 1 : secondOff;
    
    if (firstOff < rotationCycleDays) {
      offDays.push(firstOff);
    }
    if (actualSecondOff < rotationCycleDays && actualSecondOff !== firstOff) {
      offDays.push(actualSecondOff);
    }
  }
  
  return [...new Set(offDays)].sort((a, b) => a - b);
}

// Shift eligibility by role
export const ROLE_SHIFT_ELIGIBILITY: Record<Role, ShiftType[]> = {
  'Admin': ['general'],
  'Manager': ['general'],
  'TL': ['general'],
  'L3': ['morning', 'afternoon', 'night'],
  'L2': ['morning', 'afternoon', 'night'],
  'L1': ['morning', 'afternoon', 'night'],
  'HR': ['general'],
  'Trainee': ['morning', 'afternoon'],
};

// Departments that rotate through shifts
export const ROTATING_DEPARTMENTS: Department[] = [
  'Support',
  'Monitoring',
  'CloudPe',
  'Network',
  'AW',
  'Infra',
];

// Departments with fixed General shift
export const GENERAL_SHIFT_DEPARTMENTS: Department[] = [
  'HR',
  'Vendor Coordinator',
];
