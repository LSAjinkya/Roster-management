import { useEffect, useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { StatCard } from '@/components/StatCard';
import { WhosOutToday } from '@/components/WhosOutToday';
import { MyUpcomingShifts } from '@/components/MyUpcomingShifts';
import { LeaveSummaryWidget } from '@/components/LeaveSummaryWidget';
import { LeaveBalanceTracker } from '@/components/LeaveBalanceTracker';
import { LowLeaveBalanceAlert } from '@/components/LowLeaveBalanceAlert';
import { RolePermissionBadge } from '@/components/PermissionIndicator';
import { SwapRequestsManager } from '@/components/SwapRequestsManager';
import { WfhStaffWidget } from '@/components/WfhStaffWidget';
import { TodaysShiftFilter } from '@/components/TodaysShiftFilter';
import { TeamMember, Department, Role } from '@/types/roster';
import { Users, Calendar, Building2, TrendingUp, ArrowRightLeft, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);
  const { isAdmin, isHR, isTL } = useAuth();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const canSeeSwapRequests = isAdmin || isHR || isTL;

  // Fetch team members from database with refetch interval for real-time updates
  const { data: teamMembersData, isLoading: membersLoading } = useQuery({
    queryKey: ['dashboard-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email, department, status, role, reporting_tl_id');
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Map team members for SwapRequestsManager
  const teamMembersForSwap: TeamMember[] = (teamMembersData || []).map(m => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role as Role,
    department: m.department as Department,
    status: (m.status as 'available' | 'on-leave' | 'unavailable') || 'available',
    reportingTLId: m.reporting_tl_id || undefined,
  }));

  // Fetch departments from database
  const { data: departmentsData, isLoading: deptsLoading } = useQuery({
    queryKey: ['dashboard-departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch today's shift assignments with real-time updates
  const { data: todayAssignments = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['dashboard-shifts', todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('*')
        .eq('date', todayStr);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch pending swap requests count for TLs/HR/Admins
  const { data: pendingSwapCount = 0 } = useQuery({
    queryKey: ['pending-swap-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('swap_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (error) throw error;
      return count || 0;
    },
    enabled: canSeeSwapRequests,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Set up real-time subscriptions for live updates
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-team-members'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_assignments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-shifts', todayStr] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'swap_requests' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pending-swap-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, todayStr]);

  // Exclude unavailable members (left company) from counts
  const activeMembers = (teamMembersData || []).filter(m => m.status !== 'unavailable');
  const departments = departmentsData || [];
  const availableMembers = activeMembers.filter(m => m.status === 'available');
  const onLeaveMembers = activeMembers.filter(m => m.status === 'on-leave');

  const isLoading = membersLoading || deptsLoading || shiftsLoading;

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Dashboard" 
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')} 
      >
        <div className="flex items-center gap-3">
          <RolePermissionBadge />
          <Link to="/leave">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Request Leave
            </Button>
          </Link>
        </div>
      </DashboardHeader>
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Low Leave Balance Alerts */}
            <LowLeaveBalanceAlert />
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Team"
                value={activeMembers.length}
                subtitle="Active members"
                icon={Users}
                iconColor="text-primary"
              />
              <StatCard
                title="Available Today"
                value={availableMembers.length}
                subtitle={`${onLeaveMembers.length} on leave`}
                icon={TrendingUp}
                iconColor="text-status-available"
              />
              <StatCard
                title="Today's Shifts"
                value={todayAssignments.length}
                subtitle="Assignments made"
                icon={Calendar}
                iconColor="text-shift-afternoon"
              />
              {canSeeSwapRequests && (
                <Sheet open={swapSheetOpen} onOpenChange={setSwapSheetOpen}>
                  <SheetTrigger asChild>
                    <div className="cursor-pointer relative">
                      <StatCard
                        title="Pending Swaps"
                        value={pendingSwapCount}
                        subtitle="Click to review"
                        icon={ArrowRightLeft}
                        iconColor={pendingSwapCount > 0 ? "text-amber-500" : "text-muted-foreground"}
                      />
                      {pendingSwapCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center text-xs">
                          {pendingSwapCount}
                        </Badge>
                      )}
                    </div>
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
                        teamMembers={teamMembersForSwap} 
                        onApproved={() => {
                          queryClient.invalidateQueries({ queryKey: ['pending-swap-count'] });
                          queryClient.invalidateQueries({ queryKey: ['dashboard-shifts'] });
                        }} 
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <StatCard
                title="Departments"
                value={departments.length}
                subtitle="Active departments"
                icon={Building2}
                iconColor="text-shift-general"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Today's Shift Overview - Click to filter */}
              <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 overflow-hidden">
                <div className="p-4 border-b border-border/50">
                  <h2 className="font-semibold text-lg">Today's Shift Overview</h2>
                  <p className="text-sm text-muted-foreground">Click a shift to see who's working • Current shift distribution</p>
                </div>
                <div className="p-4">
                  <TodaysShiftFilter 
                    todayAssignments={todayAssignments}
                    teamMembers={activeMembers}
                  />
                </div>
              </div>

              {/* Who's Out Today + WFH Staff */}
              <WhosOutToday />
            </div>

            {/* WFH Staff Widget */}
            <WfhStaffWidget />

            {/* Leave Summary & Balance Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LeaveSummaryWidget />
              <LeaveBalanceTracker />
            </div>

            {/* My Upcoming Shifts + Department Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* My Upcoming Shifts Widget */}
              <MyUpcomingShifts />
              
              {/* Department Distribution */}
              <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 overflow-hidden">
                <div className="p-4 border-b border-border/50">
                  <h2 className="font-semibold text-lg">Department Distribution</h2>
                  <p className="text-sm text-muted-foreground">Team members by department</p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {departments.map(dept => {
                      const count = activeMembers.filter(m => m.department === dept.name).length;
                      const percentage = activeMembers.length > 0 
                        ? Math.round((count / activeMembers.length) * 100) 
                        : 0;
                      
                      return (
                        <div key={dept.id} className="text-center p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                          <p className="text-2xl font-bold text-foreground">{count}</p>
                          <p className="text-sm text-muted-foreground mt-1 truncate">{dept.name}</p>
                          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
