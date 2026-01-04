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
import { RotationPreview } from '@/components/RotationPreview';
import { RosterImportDialog } from '@/components/RosterImportDialog';
import { RosterDCTransferButton } from '@/components/RosterDCTransferButton';
import { teamMembers as mockTeamMembers } from '@/data/mockData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Calendar, CalendarRange, User, Table2, Building2, Eye, CheckCircle2, AlertCircle, Clock, Loader2, Upload } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember, Department, Role, TeamGroup, ShiftAssignment, ShiftType } from '@/types/roster';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'table' | 'member' | 'department' | 'rotation';
type RosterStatus = 'no-data' | 'draft' | 'published';

export default function Roster() {
  const { canEditShifts } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentDate] = useState(new Date());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(mockTeamMembers);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTeamMembers();
    fetchDepartments();
    fetchAssignments();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      // Fetch team members with datacenter info
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          datacenters:datacenter_id (
            id,
            code,
            name
          )
        `)
        .order('name');

      if (error) throw error;

      if (data && data.length > 0) {
        const members: TeamMember[] = data.map(member => {
          const dcData = member.datacenters as { id: string; code: string; name: string } | null;
          return {
            id: member.id,
            name: member.name || '',
            email: member.email || '',
            role: (member.role as Role) || 'L1',
            department: (member.department as Department) || 'Infra',
            team: member.team as TeamGroup | undefined,
            status: (member.status as 'available' | 'on-leave' | 'unavailable') || 'available',
            reportingTLId: member.reporting_tl_id || undefined,
            weekOffEntitlement: (member.week_off_entitlement as 1 | 2) || 2,
            isHybrid: member.is_hybrid || false,
            hybridOfficeDays: member.hybrid_office_days || 5,
            hybridWfhDays: member.hybrid_wfh_days || 0,
            workLocationId: member.work_location_id || undefined,
            datacenterId: member.datacenter_id || undefined,
            datacenterCode: dcData?.code || undefined,
            datacenterName: dcData?.name || undefined,
          };
        });
        setTeamMembers(members);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchAssignments = async () => {
    setIsLoading(true);
    try {
      // Fetch assignments for a broad date range to cover all views.
      // NOTE: the backend API paginates results (commonly 1000 rows max per request),
      // so we must page through the full result-set.
      const now = new Date();
      const pastLimit = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 3, 1));
      const futureLimit = endOfMonth(new Date(now.getFullYear(), now.getMonth() + 3, 1));

      const startDate = format(pastLimit, 'yyyy-MM-dd');
      const endDate = format(futureLimit, 'yyyy-MM-dd');

      const pageSize = 1000;
      let from = 0;
      const allRows: any[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('shift_assignments')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = data || [];
        allRows.push(...batch);

        if (batch.length < pageSize) break;
        from += pageSize;
      }

      const shiftAssignments: ShiftAssignment[] = allRows.map((a) => ({
        id: a.id,
        memberId: a.member_id,
        date: a.date,
        shiftType: a.shift_type as ShiftType,
        department: a.department as Department,
        status: a.status || 'published',
      }));

      setAssignments(shiftAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setIsLoading(false);
    }
  };


  // Determine roster status based on current month's data
  const rosterStatus = useMemo((): RosterStatus => {
    const currentMonthStart = startOfMonth(currentDate);
    const currentMonthEnd = endOfMonth(currentDate);
    const currentMonthStartStr = format(currentMonthStart, 'yyyy-MM-dd');
    const currentMonthEndStr = format(currentMonthEnd, 'yyyy-MM-dd');
    
    const currentMonthAssignments = assignments.filter(a => 
      a.date >= currentMonthStartStr && a.date <= currentMonthEndStr
    );
    
    if (currentMonthAssignments.length === 0) {
      return 'no-data';
    }
    
    // Check if any assignments are draft
    const hasDraft = currentMonthAssignments.some(a => (a as any).status === 'draft');
    if (hasDraft) {
      return 'draft';
    }
    
    return 'published';
  }, [assignments, currentDate]);

  const getRosterStatusBadge = () => {
    switch (rosterStatus) {
      case 'no-data':
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <AlertCircle size={12} />
            No Roster for {format(currentDate, 'MMMM yyyy')}
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
            <Clock size={12} />
            Draft (Unpublished)
          </Badge>
        );
      case 'published':
        return (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-300 bg-green-50">
            <CheckCircle2 size={12} />
            Published
          </Badge>
        );
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

  const handleRefresh = () => {
    fetchAssignments();
  };

  const handlePublishDraft = async () => {
    const currentMonthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const currentMonthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    
    try {
      const { error, count } = await supabase
        .from('shift_assignments')
        .update({ status: 'published' })
        .gte('date', currentMonthStart)
        .lte('date', currentMonthEnd)
        .eq('status', 'draft');

      if (error) throw error;
      
      toast.success('Roster published!', {
        description: `${format(currentDate, 'MMMM yyyy')} roster is now live.`
      });
      fetchAssignments();
    } catch (error) {
      console.error('Error publishing roster:', error);
      toast.error('Failed to publish roster');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Shift Roster" 
        subtitle="View and manage shift assignments"
      >
        <div className="flex items-center gap-3">
          {/* Roster Status Badge */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {getRosterStatusBadge()}
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {rosterStatus === 'no-data' && 'No roster has been created for this month yet'}
                  {rosterStatus === 'draft' && 'Roster is saved as draft. Click Publish to make it live.'}
                  {rosterStatus === 'published' && 'Roster is saved and published'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Publish button for draft rosters */}
          {canEditShifts && rosterStatus === 'draft' && (
            <Button onClick={handlePublishDraft} className="gap-2" size="sm">
              <Upload size={14} />
              Publish Roster
            </Button>
          )}

          {canEditShifts && (
            <>
              <RosterDCTransferButton />
              <RosterImportDialog onImportComplete={handleRefresh} />
              <SetupMonthlyRosterDialog 
                teamMembers={teamMembers} 
                departments={departments}
                onComplete={handleRefresh}
              />
            </>
          )}

          {showExport && (
            <ExportDropdown
              assignments={assignments}
              teamMembers={teamMembers}
              startDate={exportDates.start}
              endDate={exportDates.end}
              viewType={viewMode === 'weekly' ? 'weekly' : 'monthly'}
            />
          )}
        </div>
      </DashboardHeader>
      
      <div className="flex-1 overflow-auto p-6 pt-3">
        <div className="space-y-4">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="table" className="gap-2">
                <Table2 size={16} />
                <span className="hidden sm:inline">Table</span>
              </TabsTrigger>
              <TabsTrigger value="rotation" className="gap-2">
                <Eye size={16} />
                <span className="hidden sm:inline">Rotation</span>
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
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {viewMode === 'table' && (
              <TableRosterView 
                assignments={assignments} 
                teamMembers={teamMembers}
                onRefresh={handleRefresh}
              />
            )}
            {viewMode === 'rotation' && (
              <RotationPreview teamMembers={teamMembers} />
            )}
            {viewMode === 'daily' && (
              <SingleDayRosterView 
                assignments={assignments} 
                teamMembers={teamMembers} 
              />
            )}
            {viewMode === 'weekly' && (
              <WeeklyRosterView 
                assignments={assignments} 
                teamMembers={teamMembers} 
              />
            )}
            {viewMode === 'monthly' && (
              <MonthlyRosterView 
                assignments={assignments} 
                teamMembers={teamMembers} 
              />
            )}
            {viewMode === 'member' && (
              <MemberRosterView 
                assignments={assignments} 
                teamMembers={teamMembers} 
              />
            )}
            {viewMode === 'department' && (
              <DepartmentSheetView 
                assignments={assignments} 
                teamMembers={teamMembers} 
              />
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
