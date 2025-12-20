import { DashboardHeader } from '@/components/DashboardHeader';
import { TeamOverview } from '@/components/TeamOverview';
import { teamMembers } from '@/data/mockData';

export default function Team() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Team Members" 
        subtitle={`${teamMembers.length} total members across all departments`} 
      />
      
      <div className="flex-1 overflow-auto p-6">
        <TeamOverview members={teamMembers} />
      </div>
    </div>
  );
}
