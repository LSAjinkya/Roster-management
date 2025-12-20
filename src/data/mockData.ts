import { TeamMember, ShiftAssignment, Department, Role } from '@/types/roster';

const firstNames = [
  'Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Rohit', 'Neha', 
  'Arjun', 'Kavitha', 'Suresh', 'Meera', 'Arun', 'Divya', 'Karthik', 'Pooja',
  'Ravi', 'Lakshmi', 'Venkat', 'Ananya', 'Sanjay', 'Shreya', 'Deepak', 'Swati',
  'Manoj', 'Preeti', 'Gopal', 'Nisha', 'Ramesh', 'Vandana', 'Sunil', 'Rekha',
  'Ajay', 'Sunita', 'Vinod', 'Geeta', 'Prakash', 'Rashmi', 'Mukesh', 'Asha',
  'Naresh', 'Jyoti', 'Pankaj', 'Savita', 'Dinesh', 'Shobha', 'Gaurav', 'Seema',
  'Ashok', 'Usha', 'Nitin', 'Radha', 'Sandeep', 'Padma', 'Rakesh', 'Kamala',
  'Vivek', 'Shalini', 'Manish', 'Bharti', 'Yogesh', 'Alka'
];

const lastNames = [
  'Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Nair', 'Menon', 'Iyer',
  'Rao', 'Verma', 'Gupta', 'Joshi', 'Pillai', 'Nayak', 'Das', 'Bhat'
];

const departments: Department[] = ['Support', 'Monitoring', 'CloudPe', 'Network', 'AW', 'Infra', 'Vendor Coordinator'];
const roles: Role[] = ['TL', 'L2', 'L1'];

export const generateTeamMembers = (): TeamMember[] => {
  const members: TeamMember[] = [];
  
  // Generate 62 team members
  for (let i = 0; i < 62; i++) {
    const firstName = firstNames[i];
    const lastName = lastNames[i % lastNames.length];
    
    // Distribute roles: ~5 TLs, ~15 L2s, rest L1s
    let role: Role;
    if (i < 5) {
      role = 'TL';
    } else if (i < 20) {
      role = 'L2';
    } else {
      role = 'L1';
    }
    
    // Distribute departments
    const department = departments[i % departments.length];
    
    members.push({
      id: `member-${i + 1}`,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`,
      role,
      department,
      status: Math.random() > 0.1 ? 'available' : (Math.random() > 0.5 ? 'on-leave' : 'unavailable'),
    });
  }
  
  return members;
};

export const teamMembers = generateTeamMembers();

// Generate sample shift assignments for current week
export const generateWeeklyAssignments = (startDate: Date): ShiftAssignment[] => {
  const assignments: ShiftAssignment[] = [];
  const shiftTypes = ['morning', 'afternoon', 'night', 'general'] as const;
  
  for (let day = 0; day < 7; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    
    // Assign members to shifts
    let memberIndex = 0;
    
    shiftTypes.forEach(shiftType => {
      // Assign 8-10 members per shift
      const assignmentCount = shiftType === 'general' ? 5 : 10;
      
      for (let i = 0; i < assignmentCount && memberIndex < teamMembers.length; i++) {
        const member = teamMembers[(memberIndex + day * 5) % teamMembers.length];
        
        // TLs and Vendor Coordinators only on General shift
        if (shiftType === 'general' && (member.role !== 'TL' && member.department !== 'Vendor Coordinator')) {
          continue;
        }
        if (shiftType !== 'general' && (member.role === 'TL' || member.department === 'Vendor Coordinator')) {
          memberIndex++;
          continue;
        }
        
        assignments.push({
          id: `assignment-${dateStr}-${shiftType}-${i}`,
          memberId: member.id,
          shiftType,
          date: dateStr,
          department: member.department,
        });
        
        memberIndex++;
      }
    });
  }
  
  return assignments;
};

// Get current week start (Monday)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

export const currentWeekAssignments = generateWeeklyAssignments(getWeekStart(new Date()));
