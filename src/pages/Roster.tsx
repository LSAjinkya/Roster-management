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
import { SwapRequestsManager } from '@/components/SwapRequestsManager';
import { teamMembers as mockTeamMembers } from '@/data/mockData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Calendar, CalendarRange, User, Table2, Building2, Eye, ArrowLeftRight, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember, Department, Role, TeamGroup, ShiftAssignment, ShiftType } from '@/types/roster';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'table' | 'member' | 'department' | 'rotation';
type RosterStatus = 'no-data' | 'draft' | 'published';

export default function Roster() {
  const { canEditShifts } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentDate] = useState(new Date());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(mockTeamMembers);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [pendingSwapCount, setPendingSwapCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTeamMembers();
    fetchDepartments();
    fetchAssignments();
    fetchPendingSwapCount();
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
          team: member.team as TeamGroup | undefined,
          status: (member.status as 'available' | 'on-leave' | 'unavailable') || 'available',
          reportingTLId: member.reporting_tl_id || undefined,
        }));
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
      // Fetch assignments in batches to overcome the 1000 row default limit
      // Get current month and next 2 months to limit data scope
      const monthStart = startOfMonth(new Date());
      const futureLimit = endOfMonth(new Date(new Date().setMonth(new Date().getMonth() + 2)));
      const pastLimit = startOfMonth(new Date(new Date().setMonth(new Date().getMonth() - 1)));
      
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('*')
        .gte('date', format(pastLimit, 'yyyy-MM-dd'))
        .lte('date', format(futureLimit, 'yyyy-MM-dd'))
        .order('date')
        .limit(10000); // Explicitly set a higher limit

      if (error) throw error;

      if (data) {
        const shiftAssignments: ShiftAssignment[] = data.map(a => ({
          id: a.id,
          memberId: a.member_id,
          date: a.date,
          shiftType: a.shift_type as ShiftType,
          department: a.department as Department,
        }));
        setAssignments(shiftAssignments);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingSwapCount = async () => {
    try {
      const { count, error } = await supabase
        .from('swap_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      setPendingSwapCount(count || 0);
    } catch (error) {
      console.error('Error fetching swap count:', error);
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
    
    // For now, if there are assignments, consider it published
    // In a full implementation, you'd have a separate status field in the database
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
            Draft (Unsaved)
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
    fetchPendingSwapCount();
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
                  {rosterStatus === 'draft' && 'Roster changes are not yet saved'}
                  {rosterStatus === 'published' && 'Roster is saved and published'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {canEditShifts && (
            <>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="gap-2 relative">
                    <ArrowLeftRight size={16} />
                    Swap Requests
                    {pendingSwapCount > 0 && (
                      <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {pendingSwapCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[500px] sm:max-w-[500px]">
                  <SheetHeader>
                    <SheetTitle>Shift Swap Requests</SheetTitle>
                    <SheetDescription>
                      Review and approve shift swap requests from team members
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <SwapRequestsManager 
                      teamMembers={teamMembers} 
                      onApproved={handleRefresh} 
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <SetupMonthlyRosterDialog 
                teamMembers={teamMembers} 
                departments={departments}
                onComplete={handleRefresh}
              />
            </>
          )}
          
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
      
      <div className="flex-1 overflow-auto p-6">
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
  );
}
