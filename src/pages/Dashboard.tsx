import { DashboardHeader } from '@/components/DashboardHeader';
import { StatCard } from '@/components/StatCard';
import { ShiftBadge } from '@/components/ShiftBadge';
import { WhosOutToday } from '@/components/WhosOutToday';
import { MyUpcomingShifts } from '@/components/MyUpcomingShifts';
import { LeaveSummaryWidget } from '@/components/LeaveSummaryWidget';
import { LeaveBalanceTracker } from '@/components/LeaveBalanceTracker';
import { LowLeaveBalanceAlert } from '@/components/LowLeaveBalanceAlert';
import { RolePermissionBadge } from '@/components/PermissionIndicator';
import { SHIFT_DEFINITIONS } from '@/types/roster';
import { Users, Calendar, Building2, TrendingUp, ArrowRightLeft, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { isAdmin, isHR, isTL } = useAuth();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const canSeeSwapRequests = isAdmin || isHR || isTL;

  // Fetch team members from database
  const { data: teamMembersData, isLoading: membersLoading } = useQuery({
    queryKey: ['dashboard-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, department, status, role');
      
      if (error) throw error;
      return data || [];
    },
  });

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
  });

  // Fetch today's shift assignments
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
  });

  const teamMembers = teamMembersData || [];
  const departments = departmentsData || [];
  const availableMembers = teamMembers.filter(m => m.status === 'available');
  const onLeaveMembers = teamMembers.filter(m => m.status === 'on-leave');
  
  const shiftCounts = SHIFT_DEFINITIONS.reduce((acc, shift) => {
    acc[shift.id] = todayAssignments.filter(a => a.shift_type === shift.id).length;
    return acc;
  }, {} as Record<string, number>);

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
                value={teamMembers.length}
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
                <Link to="/shifts" className="block">
                  <StatCard
                    title="Pending Swaps"
                    value={pendingSwapCount}
                    subtitle="Awaiting approval"
                    icon={ArrowRightLeft}
                    iconColor={pendingSwapCount > 0 ? "text-amber-500" : "text-muted-foreground"}
                  />
                </Link>
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
              {/* Today's Shift Overview */}
              <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 overflow-hidden">
                <div className="p-4 border-b border-border/50">
                  <h2 className="font-semibold text-lg">Today's Shift Overview</h2>
                  <p className="text-sm text-muted-foreground">Current shift distribution</p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {SHIFT_DEFINITIONS.map(shift => (
                      <div 
                        key={shift.id} 
                        className={`p-4 rounded-xl border-2 ${shift.color} transition-all hover:scale-[1.02]`}
                      >
                        <ShiftBadge type={shift.id} size="sm" />
                        <p className="text-3xl font-bold mt-3">{shiftCounts[shift.id]}</p>
                        <p className="text-sm opacity-75 mt-1">{shift.startTime} - {shift.endTime}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Who's Out Today Widget */}
              <WhosOutToday />
            </div>

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
                      const count = teamMembers.filter(m => m.department === dept.name).length;
                      const percentage = teamMembers.length > 0 
                        ? Math.round((count / teamMembers.length) * 100) 
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
