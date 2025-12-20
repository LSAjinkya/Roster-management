import { DashboardHeader } from '@/components/DashboardHeader';
import { WeeklyRosterView } from '@/components/WeeklyRosterView';
import { teamMembers, currentWeekAssignments } from '@/data/mockData';

export default function Roster() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Shift Roster" 
        subtitle="Weekly shift assignments and schedules" 
      />
      
      <div className="flex-1 overflow-auto p-6">
        <WeeklyRosterView 
          assignments={currentWeekAssignments} 
          teamMembers={teamMembers} 
        />
      </div>
    </div>
  );
}
