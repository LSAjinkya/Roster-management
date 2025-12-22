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

// Get week-off days within a 15-day cycle (2+2 pattern = 4 days off)
export function getWeekOffDaysInCycle(
  cycleStartDate: Date,
  memberOffset: number,
  rotationCycleDays: number
): number[] {
  // 2+2 pattern: 2 offs in first week, 2 offs in second week
  // For 15-day cycle: offs on days ~3,4 and ~10,11 (staggered by member)
  const weekLength = 7;
  const offsPerWeek = 2;
  
  const offDays: number[] = [];
  
  // First week offs (days 5-6 of week 1, staggered)
  const week1Start = (5 + memberOffset) % weekLength;
  for (let i = 0; i < offsPerWeek; i++) {
    offDays.push((week1Start + i) % rotationCycleDays);
  }
  
  // Second week offs (days 5-6 of week 2, staggered)
  const week2Start = (weekLength + 5 + memberOffset) % rotationCycleDays;
  for (let i = 0; i < offsPerWeek; i++) {
    const day = (week2Start + i) % rotationCycleDays;
    if (!offDays.includes(day)) {
      offDays.push(day);
    }
  }
  
  return offDays.sort((a, b) => a - b);
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
