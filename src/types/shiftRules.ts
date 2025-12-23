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
  type: 'shortage' | 'constraint' | 'rest' | 'cycle' | 'stability' | 'night-safety';
  shift_type: ShiftType;
  department: Department;
  datacenter_id?: string | null;
  required: number;
  actual: number;
  date: string;
  message: string;
  memberId?: string;
  severity: 'error' | 'warning';
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

// =====================================================
// CORE CONSTANTS - SHIFT RULES
// =====================================================

// Rule 1: Core Work Cycle - 5 work days + 2 OFF days
export const WORK_DAYS_IN_CYCLE = 5;
export const OFF_DAYS_IN_CYCLE = 2;
export const CYCLE_LENGTH = WORK_DAYS_IN_CYCLE + OFF_DAYS_IN_CYCLE; // 7 days

// Rule 2: Shift Stability - Same shift for 10 working days
export const SHIFT_STABILITY_WORK_DAYS = 10;
// Full shift cycle = 10 work days + 4 OFF days (2 blocks of 2)
export const SHIFT_CYCLE_CALENDAR_DAYS = 14; // 10 work + 4 OFF

// Rule 4: Shift Rotation Order
export const SHIFT_ROTATION_ORDER: ShiftType[] = ['afternoon', 'morning', 'night'];

// Rule 5: Night Shift Safety - REST days required before night shift
export const REST_DAYS_BEFORE_NIGHT = 2;

// =====================================================
// ASSIGNMENT CONFIG
// =====================================================

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
  shiftSequence: string[];
}

export const DEFAULT_ASSIGNMENT_CONFIG: AutoAssignmentConfig = {
  respectWeeklyOffs: true,
  respectLeaves: true,
  respectPublicHolidays: true,
  work_days: WORK_DAYS_IN_CYCLE,
  off_days: OFF_DAYS_IN_CYCLE,
  maxConsecutiveNights: 5,
  minRestHours: 12,
  rotationCycleDays: SHIFT_CYCLE_CALENDAR_DAYS,
  flagShortages: true,
  shiftSequence: SHIFT_ROTATION_ORDER,
};

// =====================================================
// MEMBER SHIFT CYCLE TRACKING
// =====================================================

export interface MemberShiftCycle {
  memberId: string;
  cycleStartDate: Date;
  currentShiftType: ShiftType;
  workDaysCompleted: number;
  offDaysCompleted: number;
}

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

// =====================================================
// WORK CYCLE FUNCTIONS (5 WORK + 2 OFF)
// =====================================================

/**
 * Get week-off days for a member within their cycle.
 * Pattern: 5 consecutive work days, then 2 consecutive OFF days.
 * Member offset staggers which calendar day their OFF days fall on.
 * 
 * @param cycleStartDate - The start date of the member's current shift cycle
 * @param memberOffset - Offset (0-6) to stagger OFF days across team members
 * @param totalDays - Total days to calculate for
 * @returns Array of day indices (0-based from cycleStartDate) that are OFF days
 */
export function getWeekOffDaysInCycle(
  cycleStartDate: Date,
  memberOffset: number,
  totalDays: number
): number[] {
  const offDays: number[] = [];
  
  // Calculate the starting position in the 7-day cycle based on member offset
  // This staggers when each member's 2-day OFF block occurs
  const cycleOffset = memberOffset % CYCLE_LENGTH;
  
  for (let day = 0; day < totalDays; day++) {
    // Calculate position in the 7-day work cycle (5 work + 2 off)
    const positionInCycle = (day + CYCLE_LENGTH - cycleOffset) % CYCLE_LENGTH;
    
    // Days 5 and 6 in the cycle are OFF days (0-4 are work days)
    if (positionInCycle >= WORK_DAYS_IN_CYCLE) {
      offDays.push(day);
    }
  }
  
  return offDays;
}

/**
 * Calculate which shift a member should be on for a specific date.
 * Shift changes only after completing 10 work days.
 * 
 * @param cycleStartDate - When the member started their current shift cycle
 * @param targetDate - The date to check
 * @param currentShiftType - The member's starting shift type
 * @param memberOffset - Member's offset for week-off staggering
 * @returns The shift type for the target date
 */
export function getMemberShiftForDate(
  cycleStartDate: Date,
  targetDate: Date,
  currentShiftType: ShiftType,
  memberOffset: number
): ShiftType {
  const daysDiff = Math.floor((targetDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff < 0) return currentShiftType;
  
  // Count work days from cycle start to target date
  let workDaysCount = 0;
  for (let i = 0; i <= daysDiff; i++) {
    const positionInCycle = (i + CYCLE_LENGTH - (memberOffset % CYCLE_LENGTH)) % CYCLE_LENGTH;
    if (positionInCycle < WORK_DAYS_IN_CYCLE) {
      workDaysCount++;
    }
  }
  
  // Calculate how many full shift cycles (10 work days each) have passed
  const shiftCyclesPassed = Math.floor(workDaysCount / SHIFT_STABILITY_WORK_DAYS);
  
  // Get the new shift based on rotation order
  const currentIndex = SHIFT_ROTATION_ORDER.indexOf(currentShiftType);
  if (currentIndex === -1) return SHIFT_ROTATION_ORDER[0];
  
  const newIndex = (currentIndex + shiftCyclesPassed) % SHIFT_ROTATION_ORDER.length;
  return SHIFT_ROTATION_ORDER[newIndex];
}

/**
 * Check if a date should be an OFF day for a member
 */
export function isOffDay(
  cycleStartDate: Date,
  targetDate: Date,
  memberOffset: number
): boolean {
  const daysDiff = Math.floor((targetDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const positionInCycle = (daysDiff + CYCLE_LENGTH - (memberOffset % CYCLE_LENGTH)) % CYCLE_LENGTH;
  return positionInCycle >= WORK_DAYS_IN_CYCLE;
}

/**
 * Get the previous shift type in the rotation order
 */
export function getPreviousShift(shiftType: ShiftType): ShiftType {
  const index = SHIFT_ROTATION_ORDER.indexOf(shiftType);
  if (index <= 0) return SHIFT_ROTATION_ORDER[SHIFT_ROTATION_ORDER.length - 1];
  return SHIFT_ROTATION_ORDER[index - 1];
}

/**
 * Check if transitioning from one shift to night shift requires rest days
 */
export function requiresRestBeforeNight(previousShift: ShiftType, newShift: ShiftType): boolean {
  if (newShift !== 'night') return false;
  return previousShift === 'morning' || previousShift === 'afternoon';
}

// =====================================================
// ROLE & DEPARTMENT ELIGIBILITY
// =====================================================

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

/**
 * Check if a role is eligible for a specific shift type
 */
export function isRoleEligibleForShift(role: Role, shiftType: ShiftType): boolean {
  const eligible = ROLE_SHIFT_ELIGIBILITY[role];
  return eligible ? eligible.includes(shiftType) : false;
}

/**
 * Check if a department uses rotation shifts
 */
export function isDepartmentRotating(department: Department): boolean {
  return ROTATING_DEPARTMENTS.includes(department);
}
