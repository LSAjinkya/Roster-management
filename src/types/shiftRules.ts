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
  flagShortages: boolean; // Instead of auto-violating rules
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
};

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
