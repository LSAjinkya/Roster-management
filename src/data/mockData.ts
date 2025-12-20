import { TeamMember, ShiftAssignment, Department, ShiftType } from '@/types/roster';

// Actual team members data
export const teamMembers: TeamMember[] = [
  // Support TLs
  { id: 'tl-support-1', name: 'Suresh Tavare', email: 'suresh.tavare@leapswitch.com', role: 'TL', department: 'Support', status: 'available' },
  { id: 'tl-support-2', name: 'Ajinkya Lawand', email: 'ajinkya.lawand@leapswitch.com', role: 'TL', department: 'Support', status: 'available' },
  
  // Support L2
  { id: 'l2-support-1', name: 'Anil Anirudh', email: 'anil.anirudh@leapswitch.com', role: 'L2', department: 'Support', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l2-support-2', name: 'Kadhar Saheed', email: 'kadhar.saheed@leapswitch.com', role: 'L2', department: 'Support', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l2-support-3', name: 'Aavesh Khan', email: 'aavesh.khan@leapswitch.com', role: 'L2', department: 'Support', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l2-support-4', name: 'Ajay Kushwaha', email: 'ajay.kushwaha@leapswitch.com', role: 'L2', department: 'Support', status: 'available', reportingTLId: 'tl-support-2' },
  { id: 'l2-support-5', name: 'Harshita Sharma', email: 'harshita.sharma@leapswitch.com', role: 'L2', department: 'Support', status: 'available', reportingTLId: 'tl-support-2' },
  { id: 'l2-support-6', name: 'Saurabh Naikare', email: 'saurabh.naikare@leapswitch.com', role: 'L2', department: 'Support', status: 'available', reportingTLId: 'tl-support-2' },
  { id: 'l2-support-7', name: 'Mahesh Junnare', email: 'mahesh.junnare@leapswitch.com', role: 'L2', department: 'Support', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l2-support-8', name: 'David Nadar', email: 'david.nadar@leapswitch.com', role: 'L2', department: 'Support', status: 'available', reportingTLId: 'tl-support-2' },
  
  // Support L1
  { id: 'l1-support-1', name: 'Abijai', email: 'abijai@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l1-support-2', name: 'Hari Vignesh', email: 'hari.vignesh@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l1-support-3', name: 'Sushmita Naikodi', email: 'sushmita.naikodi@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l1-support-4', name: 'Anamika', email: 'anamika@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l1-support-5', name: 'Muktha Jayanna', email: 'muktha.jayanna@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-2' },
  { id: 'l1-support-6', name: 'Gajendra', email: 'gajendra@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-2' },
  { id: 'l1-support-7', name: 'Yasir', email: 'yasir@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-2' },
  { id: 'l1-support-8', name: 'Somnath Shinde', email: 'somnath.shinde@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-2' },
  { id: 'l1-support-9', name: 'Abhijit Kude', email: 'abhijit.kude@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l1-support-10', name: 'Vikas Gacche', email: 'vikas.gacche@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l1-support-11', name: 'Narayan Khamkar', email: 'narayan.khamkar@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-2' },
  { id: 'l1-support-12', name: 'Dipali Moraskar', email: 'dipali.moraskar@leapswitch.com', role: 'L1', department: 'Support', status: 'available', reportingTLId: 'tl-support-2' },
  
  // AW Team (L1)
  { id: 'l1-aw-1', name: 'Vaibhav Borse', email: 'vaibhav.borse@leapswitch.com', role: 'L1', department: 'AW', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l1-aw-2', name: 'Nilesh Nage', email: 'nilesh.nage@leapswitch.com', role: 'L1', department: 'AW', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l1-aw-3', name: 'Tushar', email: 'tushar@leapswitch.com', role: 'L1', department: 'AW', status: 'available', reportingTLId: 'tl-support-1' },
  { id: 'l1-aw-4', name: 'Omkar Y', email: 'omkar.y@leapswitch.com', role: 'L1', department: 'AW', status: 'available', reportingTLId: 'tl-support-1' },
  
  // Monitoring TL
  { id: 'tl-monitoring-1', name: 'Deepak Singh', email: 'deepak.singh@leapswitch.com', role: 'TL', department: 'Monitoring', status: 'available' },
  
  // Monitoring Team (L1)
  { id: 'l1-monitoring-1', name: 'Vivek B', email: 'vivek.b@leapswitch.com', role: 'L1', department: 'Monitoring', status: 'available', reportingTLId: 'tl-monitoring-1' },
  { id: 'l1-monitoring-2', name: 'Abhishek Sonawane', email: 'abhishek.sonawane@leapswitch.com', role: 'L1', department: 'Monitoring', status: 'available', reportingTLId: 'tl-monitoring-1' },
  { id: 'l1-monitoring-3', name: 'Swapnil Rasal', email: 'swapnil.rasal@leapswitch.com', role: 'L1', department: 'Monitoring', status: 'available', reportingTLId: 'tl-monitoring-1' },
  { id: 'l1-monitoring-4', name: 'Swapnil Pawar', email: 'swapnil.pawar@leapswitch.com', role: 'L1', department: 'Monitoring', status: 'available', reportingTLId: 'tl-monitoring-1' },
  { id: 'l1-monitoring-5', name: 'Shivam Patankar', email: 'shivam.patankar@leapswitch.com', role: 'L1', department: 'Monitoring', status: 'available', reportingTLId: 'tl-monitoring-1' },
  
  // CloudPe TLs
  { id: 'tl-cloudpe-1', name: 'Amol Mahajan', email: 'amol.mahajan@leapswitch.com', role: 'TL', department: 'CloudPe', status: 'available' },
  { id: 'tl-cloudpe-2', name: 'Swapnil Aher', email: 'swapnil.aher@leapswitch.com', role: 'TL', department: 'CloudPe', status: 'available' },
  
  // CloudPe Junior Team (L1)
  { id: 'l1-cloudpe-1', name: 'Chaitanya Patil', email: 'chaitanya.patil@leapswitch.com', role: 'L1', department: 'CloudPe', status: 'available', reportingTLId: 'tl-cloudpe-1' },
  { id: 'l1-cloudpe-2', name: 'Pawan Maithil', email: 'pawan.maithil@leapswitch.com', role: 'L1', department: 'CloudPe', status: 'available', reportingTLId: 'tl-cloudpe-1' },
  { id: 'l1-cloudpe-3', name: 'Durvesh Khatale', email: 'durvesh.khatale@leapswitch.com', role: 'L1', department: 'CloudPe', status: 'available', reportingTLId: 'tl-cloudpe-2' },
  { id: 'l1-cloudpe-4', name: 'Suraj Divate', email: 'suraj.divate@leapswitch.com', role: 'L1', department: 'CloudPe', status: 'available', reportingTLId: 'tl-cloudpe-2' },
  
  // Network TLs
  { id: 'tl-network-1', name: 'Akar Periwal', email: 'akar.periwal@leapswitch.com', role: 'TL', department: 'Network', status: 'available' },
  { id: 'tl-network-2', name: 'Pravin Dodtale', email: 'pravin.dodtale@leapswitch.com', role: 'TL', department: 'Network', status: 'available' },
  
  // Network L1 Team
  { id: 'l1-network-1', name: 'Pratik Jawle', email: 'pratik.jawle@leapswitch.com', role: 'L1', department: 'Network', status: 'available', reportingTLId: 'tl-network-1' },
  { id: 'l1-network-2', name: 'Rushabh Dhapke', email: 'rushabh.dhapke@leapswitch.com', role: 'L1', department: 'Network', status: 'available', reportingTLId: 'tl-network-1' },
  { id: 'l1-network-3', name: 'Nikita Verma', email: 'nikita.verma@leapswitch.com', role: 'L1', department: 'Network', status: 'available', reportingTLId: 'tl-network-2' },
  { id: 'l1-network-4', name: 'Piyush Jha', email: 'piyush.jha@leapswitch.com', role: 'L1', department: 'Network', status: 'available', reportingTLId: 'tl-network-2' },
  { id: 'l1-network-5', name: 'Ashish Rajput', email: 'ashish.rajput@leapswitch.com', role: 'L1', department: 'Network', status: 'available', reportingTLId: 'tl-network-2' },
  
  // Vendor Coordinator
  { id: 'vc-1', name: 'Virendra', email: 'virendra@leapswitch.com', role: 'L1', department: 'Vendor Coordinator', status: 'available', reportingTLId: 'tl-support-1' },
  
  // Infra TLs
  { id: 'tl-infra-1', name: 'Ankur', email: 'ankur@leapswitch.com', role: 'TL', department: 'Infra', status: 'available' },
  { id: 'tl-infra-2', name: 'Salman Khan', email: 'salman.khan@leapswitch.com', role: 'TL', department: 'Infra', status: 'available' },
  
  // Infra LnT Datacenter (L1)
  { id: 'l1-infra-lnt-1', name: 'Alok Kumar', email: 'alok.kumar@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-1' },
  { id: 'l1-infra-lnt-2', name: 'Abhijeet Shinde', email: 'abhijeet.shinde@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-1' },
  { id: 'l1-infra-lnt-3', name: 'Siddhesh Patil', email: 'siddhesh.patil@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-1' },
  { id: 'l1-infra-lnt-4', name: 'Rajeev Jha', email: 'rajeev.jha@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-1' },
  { id: 'l1-infra-lnt-5', name: 'Sachin Pawar', email: 'sachin.pawar@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-1' },
  { id: 'l1-infra-lnt-6', name: 'Abu Salim', email: 'abu.salim@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-1' },
  { id: 'l1-infra-lnt-7', name: 'Shriram Patil', email: 'shriram.patil@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-1' },
  
  // Infra Yotta Datacenter (L1)
  { id: 'l1-infra-yotta-1', name: 'Vikas Yadav', email: 'vikas.yadav@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-2' },
  { id: 'l1-infra-yotta-2', name: 'Akash Yadav', email: 'akash.yadav@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-2' },
  { id: 'l1-infra-yotta-3', name: 'Aniket Jagdale', email: 'aniket.jagdale@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-2' },
  { id: 'l1-infra-yotta-4', name: 'Rahul Jadhav', email: 'rahul.jadhav@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-2' },
  { id: 'l1-infra-yotta-5', name: 'Akash Pawar', email: 'akash.pawar@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-2' },
  { id: 'l1-infra-yotta-6', name: 'Karan Pawar', email: 'karan.pawar@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-2' },
  { id: 'l1-infra-yotta-7', name: 'Hemant Gujar', email: 'hemant.gujar@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-2' },
  { id: 'l1-infra-yotta-8', name: 'Ganesh', email: 'ganesh@leapswitch.com', role: 'L1', department: 'Infra', status: 'available', reportingTLId: 'tl-infra-2' },
  
  // HR Team (Admin role)
  { id: 'hr-1', name: 'Ayushi Parshivar', email: 'ayushi.parshivar@leapswitch.com', role: 'HR', department: 'HR', status: 'available' },
  { id: 'hr-2', name: 'Chandar Rana Singh', email: 'chandar.ranasingh@leapswitch.com', role: 'HR', department: 'HR', status: 'available' },
  { id: 'hr-3', name: 'Tejashri Mandhare', email: 'tejashri.mandhare@leapswitch.com', role: 'HR', department: 'HR', status: 'available' },
];

// Generate sample shift assignments for current week
export const generateWeeklyAssignments = (startDate: Date): ShiftAssignment[] => {
  const assignments: ShiftAssignment[] = [];
  const shiftTypes: ShiftType[] = ['morning', 'afternoon', 'night', 'general'];
  
  // Filter out TLs, HR, and Vendor Coordinator for rotational shifts
  const rotationalMembers = teamMembers.filter(m => m.role !== 'TL' && m.role !== 'HR' && m.department !== 'Vendor Coordinator');
  const tlsAndVC = teamMembers.filter(m => m.role === 'TL' || m.department === 'Vendor Coordinator');
  
  for (let day = 0; day < 7; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    
    // Assign rotational members to morning, afternoon, night shifts
    let memberIndex = (day * 8) % rotationalMembers.length;
    
    ['morning', 'afternoon', 'night'].forEach((shiftType) => {
      const assignmentCount = 8;
      
      for (let i = 0; i < assignmentCount; i++) {
        const member = rotationalMembers[(memberIndex + i) % rotationalMembers.length];
        
        assignments.push({
          id: `assignment-${dateStr}-${shiftType}-${i}`,
          memberId: member.id,
          shiftType: shiftType as ShiftType,
          date: dateStr,
          department: member.department,
        });
      }
      memberIndex += assignmentCount;
    });
    
    // TLs and Vendor Coordinator on General shift
    tlsAndVC.forEach((member, i) => {
      assignments.push({
        id: `assignment-${dateStr}-general-${i}`,
        memberId: member.id,
        shiftType: 'general',
        date: dateStr,
        department: member.department,
      });
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
