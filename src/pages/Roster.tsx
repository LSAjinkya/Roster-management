import { useState, useMemo, useEffect } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { WeeklyRosterView } from '@/components/WeeklyRosterView';
import { SingleDayRosterView } from '@/components/SingleDayRosterView';
import { MonthlyRosterView } from '@/components/MonthlyRosterView';
import { MemberRosterView } from '@/components/MemberRosterView';
import { TableRosterView } from '@/components/TableRosterView';
import { DepartmentSheetView } from '@/components/DepartmentSheetView';
import { ExportDropdown } from '@/components/ExportDropdown';
import { SetupMonthlyRosterDialog } from '@/components/SetupMonthlyRosterDialog';
import { teamMembers as mockTeamMembers, currentWeekAssignments } from '@/data/mockData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Calendar, CalendarRange, User, Table2, Building2 } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember, Department, Role } from '@/types/roster';
import { useAuth } from '@/hooks/useAuth';

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'table' | 'member' | 'department';

export default function Roster() {
  const { canEditShifts } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentDate] = useState(new Date());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(mockTeamMembers);

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

      if (data && data.length > 0) {
        const members: TeamMember[] = data.map(member => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role as Role,
          department: member.department as Department,
          status: (member.status as 'available' | 'on-leave' | 'unavailable') || 'available',
          reportingTLId: member.reporting_tl_id || undefined,
        }));
        setTeamMembers(members);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  // Calculate date ranges for export
  const exportDates = useMemo(() => {
    if (viewMode === 'weekly') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return { start, end };
    } else if (viewMode === 'monthly' || viewMode === 'member' || viewMode === 'table') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return { start, end };
    }
    return { start: currentDate, end: currentDate };
  }, [viewMode, currentDate]);

  const showExport = canEditShifts && (viewMode === 'weekly' || viewMode === 'monthly');

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Shift Roster" 
        subtitle="View and manage shift assignments"
      >
        <div className="flex items-center gap-3">
          {canEditShifts && <SetupMonthlyRosterDialog teamMembers={teamMembers} />}
          
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="table" className="gap-2">
                <Table2 size={16} />
                <span className="hidden sm:inline">Table</span>
              </TabsTrigger>
              <TabsTrigger value="daily" className="gap-2">
                <CalendarDays size={16} />
                <span className="hidden sm:inline">Daily</span>
              </TabsTrigger>
              <TabsTrigger value="weekly" className="gap-2">
                <CalendarRange size={16} />
                <span className="hidden sm:inline">Weekly</span>
              </TabsTrigger>
              <TabsTrigger value="monthly" className="gap-2">
                <Calendar size={16} />
                <span className="hidden sm:inline">Monthly</span>
              </TabsTrigger>
              <TabsTrigger value="member" className="gap-2">
                <User size={16} />
                <span className="hidden sm:inline">Member</span>
              </TabsTrigger>
              <TabsTrigger value="department" className="gap-2">
                <Building2 size={16} />
                <span className="hidden sm:inline">Department</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {showExport && (
            <ExportDropdown
              assignments={currentWeekAssignments}
              teamMembers={teamMembers}
              startDate={exportDates.start}
              endDate={exportDates.end}
              viewType={viewMode === 'weekly' ? 'weekly' : 'monthly'}
            />
          )}
        </div>
      </DashboardHeader>
      
      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'table' && (
          <TableRosterView 
            assignments={currentWeekAssignments} 
            teamMembers={teamMembers} 
          />
        )}
        {viewMode === 'daily' && (
          <SingleDayRosterView 
            assignments={currentWeekAssignments} 
            teamMembers={teamMembers} 
          />
        )}
        {viewMode === 'weekly' && (
          <WeeklyRosterView 
            assignments={currentWeekAssignments} 
            teamMembers={teamMembers} 
          />
        )}
        {viewMode === 'monthly' && (
          <MonthlyRosterView 
            assignments={currentWeekAssignments} 
            teamMembers={teamMembers} 
          />
        )}
        {viewMode === 'member' && (
          <MemberRosterView 
            assignments={currentWeekAssignments} 
            teamMembers={teamMembers} 
          />
        )}
        {viewMode === 'department' && (
          <DepartmentSheetView 
            assignments={currentWeekAssignments} 
            teamMembers={teamMembers} 
          />
        )}
      </div>
    </div>
  );
}
