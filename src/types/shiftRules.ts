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

// Get week-off days within a 14-day cycle (2 days off per week = 4 days total)
// Week-offs can be on ANY day, staggered by member offset to distribute evenly
export function getWeekOffDaysInCycle(
  cycleStartDate: Date,
  memberOffset: number,
  rotationCycleDays: number
): number[] {
  // For a 14-day cycle: 2 days off each week (4 days total)
  // Distribute off days evenly across all 7 days of the week using member offset
  const offDays: number[] = [];
  
  // Calculate off days for week 1 (days 0-6)
  // Use member offset to stagger across all days of the week
  const week1FirstOff = memberOffset % 7;
  const week1SecondOff = (week1FirstOff + 3) % 7; // Space them ~3 days apart within the week
  offDays.push(week1FirstOff);
  offDays.push(week1SecondOff);
  
  // Calculate off days for week 2 (days 7-13)
  // Offset by 1 from week 1 pattern to create variety
  const week2FirstOff = 7 + ((week1FirstOff + 1) % 7);
  const week2SecondOff = 7 + ((week1SecondOff + 1) % 7);
  
  if (week2FirstOff < rotationCycleDays) {
    offDays.push(week2FirstOff);
  }
  if (week2SecondOff < rotationCycleDays && week2SecondOff !== week2FirstOff) {
    offDays.push(week2SecondOff);
  }
  
  // Ensure we always have exactly 4 offs for 14-day cycle (2 per week)
  // If we have duplicates or missing days, adjust
  const uniqueOffs = [...new Set(offDays)].sort((a, b) => a - b);
  
  return uniqueOffs;
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
