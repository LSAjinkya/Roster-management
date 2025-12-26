import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { TeamOverview } from '@/components/TeamOverview';
import { TeamRosterView } from '@/components/TeamRosterView';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember, Department, Role, ShiftAssignment } from '@/types/roster';
import { Loader2, Users, LayoutGrid } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

type ViewMode = 'overview' | 'team';

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  useEffect(() => {
    fetchTeamMembers();
    fetchAssignments();
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
        team: member.team as TeamMember['team'],
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

  const fetchAssignments = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('*')
        .gte('date', today)
        .order('date');

      if (error) throw error;

      const shiftAssignments: ShiftAssignment[] = (data || []).map(a => ({
        id: a.id,
        memberId: a.member_id,
        date: a.date,
        shiftType: a.shift_type as ShiftAssignment['shiftType'],
        department: a.department as Department,
      }));

      setAssignments(shiftAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
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
        <div className="space-y-6">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="overview" className="gap-2">
                <LayoutGrid size={16} />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="gap-2">
                <Users size={16} />
                <span className="hidden sm:inline">Team View</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {viewMode === 'overview' && (
            <TeamOverview members={members} onMemberUpdate={fetchTeamMembers} />
          )}
          {viewMode === 'team' && (
            <TeamRosterView 
              assignments={assignments} 
              teamMembers={members}
            />
          )}
        </div>
      </div>
    </div>
  );
}
