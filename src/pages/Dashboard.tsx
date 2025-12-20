import { DashboardHeader } from '@/components/DashboardHeader';
import { StatCard } from '@/components/StatCard';
import { ShiftBadge } from '@/components/ShiftBadge';
import { WhosOutToday } from '@/components/WhosOutToday';
import { teamMembers, currentWeekAssignments } from '@/data/mockData';
import { SHIFT_DEFINITIONS, DEPARTMENTS } from '@/types/roster';
import { Users, Calendar, Building2, TrendingUp, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { isAdmin, isHR, isTL } = useAuth();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayAssignments = currentWeekAssignments.filter(a => a.date === todayStr);
  
  const availableMembers = teamMembers.filter(m => m.status === 'available');
  const onLeaveMembers = teamMembers.filter(m => m.status === 'on-leave');
  
  const shiftCounts = SHIFT_DEFINITIONS.reduce((acc, shift) => {
    acc[shift.id] = todayAssignments.filter(a => a.shiftType === shift.id).length;
    return acc;
  }, {} as Record<string, number>);

  const canSeeSwapRequests = isAdmin || isHR || isTL;

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

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Dashboard" 
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')} 
      />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
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
            value={DEPARTMENTS.length}
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

        {/* Department Distribution */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="font-semibold text-lg">Department Distribution</h2>
            <p className="text-sm text-muted-foreground">Team members by department</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {DEPARTMENTS.map(dept => {
                const count = teamMembers.filter(m => m.department === dept).length;
                const percentage = Math.round((count / teamMembers.length) * 100);
                
                return (
                  <div key={dept} className="text-center p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                    <p className="text-2xl font-bold text-foreground">{count}</p>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{dept}</p>
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
    </div>
  );
}
