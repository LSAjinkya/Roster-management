import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { TeamOverview } from '@/components/TeamOverview';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember, Department, Role } from '@/types/roster';
import { Loader2 } from 'lucide-react';

// Map app_role to Role type for display
const mapAppRoleToRole = (appRole: string): Role => {
  switch (appRole) {
    case 'admin':
    case 'tl':
      return 'TL';
    case 'hr':
      return 'HR';
    default:
      return 'L1';
  }
};

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      // Fetch profiles with their departments
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, department')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Transform profiles to TeamMember format
      const teamMembers: TeamMember[] = (profiles || [])
        .filter(p => p.department) // Only include users with a department
        .map(profile => {
          const userRole = (allRoles || []).find(r => r.user_id === profile.user_id);
          return {
            id: profile.user_id,
            name: profile.full_name,
            email: profile.email,
            role: mapAppRoleToRole(userRole?.role || 'member'),
            department: profile.department as Department,
            status: 'available' as const,
          };
        });

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
        <TeamOverview members={members} />
      </div>
    </div>
  );
}
