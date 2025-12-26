export type ShiftType = 'morning' | 'afternoon' | 'night' | 'general' | 'leave' | 'comp-off' | 'week-off' | 'public-off' | 'paid-leave';

export type Role = 'TL' | 'L3' | 'L2' | 'L1' | 'HR' | 'Manager' | 'Trainee' | 'Admin';

export type Department = 
  | 'Support' 
  | 'Monitoring' 
  | 'CloudPe' 
  | 'Network' 
  | 'AW' 
  | 'Infra' 
  | 'Vendor Coordinator'
  | 'HR'
  | 'Sales'
  | 'Admin'
  | 'Marketing'
  | 'Billing'
  | 'CO'
  | 'Development';

export type UserRole = 'admin' | 'hr' | 'tl' | 'member';

// Team groups for synchronized shift rotation (Alpha, Gamma, Beta)
export type TeamGroup = 'Alpha' | 'Gamma' | 'Beta';

export const TEAM_GROUPS: TeamGroup[] = ['Alpha', 'Beta', 'Gamma'];

// Team shift assignment - each team is in one shift at a time
// When Alpha is in Morning, Beta is in Afternoon, Gamma is in Night
// This rotates: after shift cycle, Alpha → Afternoon, Beta → Night, Gamma → Morning
export const TEAM_BASE_SHIFTS: Record<TeamGroup, ShiftType> = {
  'Alpha': 'morning',
  'Beta': 'afternoon',
  'Gamma': 'night',
};

// Calculate team's shift based on cycle number
// Cycle 0: Alpha=Morning, Beta=Afternoon, Gamma=Night
// Cycle 1: Alpha=Afternoon, Beta=Night, Gamma=Morning
// Cycle 2: Alpha=Night, Beta=Morning, Gamma=Afternoon
export function getTeamShiftForCycle(team: TeamGroup, cycleNumber: number): ShiftType {
  const shiftOrder: ShiftType[] = ['morning', 'afternoon', 'night'];
  const teamIndex = TEAM_GROUPS.indexOf(team);
  const shiftIndex = (teamIndex + cycleNumber) % 3;
  return shiftOrder[shiftIndex];
}

// Get all teams and their shifts for a given cycle
export function getAllTeamShiftsForCycle(cycleNumber: number): Record<TeamGroup, ShiftType> {
  return {
    'Alpha': getTeamShiftForCycle('Alpha', cycleNumber),
    'Beta': getTeamShiftForCycle('Beta', cycleNumber),
    'Gamma': getTeamShiftForCycle('Gamma', cycleNumber),
  };
}

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
  team?: TeamGroup; // Alpha, Gamma, or Beta
  avatar?: string;
  status: 'available' | 'on-leave' | 'unavailable';
  reportingTLId?: string; // Assigned based on department
  weekOffEntitlement?: 1 | 2; // 1 or 2 OFF days per cycle (default: 2)
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
  { id: 'leave', name: 'Leave', startTime: '', endTime: '', color: 'shift-leave' },
  { id: 'comp-off', name: 'CO', startTime: '', endTime: '', color: 'shift-compoff' },
  { id: 'week-off', name: 'OFF', startTime: '', endTime: '', color: 'shift-weekoff' },
  { id: 'public-off', name: 'PO', startTime: '', endTime: '', color: 'shift-publicoff' },
  { id: 'paid-leave', name: 'PL', startTime: '', endTime: '', color: 'shift-paidleave' },
];

export const DEPARTMENTS: Department[] = [
  'Support',
  'Monitoring',
  'CloudPe',
  'Network',
  'AW',
  'Infra',
  'Vendor Coordinator',
  'HR',
  'Sales',
  'Admin',
  'Marketing',
  'Billing',
  'CO',
  'Development',
];

export const ROLES: Role[] = ['Admin', 'Manager', 'TL', 'L3', 'L2', 'L1', 'HR', 'Trainee'];
