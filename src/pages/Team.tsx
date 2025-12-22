import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { TeamOverview } from '@/components/TeamOverview';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember, Department, Role } from '@/types/roster';
import { Loader2 } from 'lucide-react';

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('name');

      if (error) throw error;

      const teamMembers: TeamMember[] = (data || []).map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role as Role,
        department: member.department as Department,
        status: (member.status as 'available' | 'on-leave' | 'unavailable') || 'available',
        reportingTLId: member.reporting_tl_id || undefined,
      }));

      setMembers(teamMembers);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader 
          title="Team Members" 
          subtitle="Loading team data..." 
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Team Members" 
        subtitle={`${members.length} total members across all departments`} 
      />
      
      <div className="flex-1 overflow-auto p-6">
        <TeamOverview members={members} onMemberUpdate={fetchTeamMembers} />
      </div>
    </div>
  );
}
