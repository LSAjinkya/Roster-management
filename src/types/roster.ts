export type ShiftType = 'morning' | 'afternoon' | 'night' | 'general';

export type Role = 'TL' | 'L2' | 'L1';

export type Department = 
  | 'Support' 
  | 'Monitoring' 
  | 'CloudPe' 
  | 'Network' 
  | 'AW' 
  | 'Infra' 
  | 'Vendor Coordinator';

export type UserRole = 'admin' | 'tl' | 'member';

export interface ShiftDefinition {
  id: ShiftType;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: Department;
  avatar?: string;
  status: 'available' | 'on-leave' | 'unavailable';
  reportingTLId?: string; // Assigned based on department
}

export interface ShiftAssignment {
  id: string;
  memberId: string;
  shiftType: ShiftType;
  date: string;
  department: Department;
}

export interface DailyRoster {
  date: string;
  shifts: {
    morning: ShiftAssignment[];
    afternoon: ShiftAssignment[];
    night: ShiftAssignment[];
    general: ShiftAssignment[];
  };
}

export const SHIFT_DEFINITIONS: ShiftDefinition[] = [
  { id: 'morning', name: 'Morning', startTime: '07:00', endTime: '16:00', color: 'shift-morning' },
  { id: 'afternoon', name: 'Afternoon', startTime: '13:00', endTime: '22:00', color: 'shift-afternoon' },
  { id: 'night', name: 'Night', startTime: '21:00', endTime: '07:00', color: 'shift-night' },
  { id: 'general', name: 'General', startTime: '10:00', endTime: '19:00', color: 'shift-general' },
];

export const DEPARTMENTS: Department[] = [
  'Support',
  'Monitoring',
  'CloudPe',
  'Network',
  'AW',
  'Infra',
  'Vendor Coordinator',
];

export const ROLES: Role[] = ['TL', 'L2', 'L1'];
