import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Briefcase, HeartPulse, Flag, Settings2, Search } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { LeaveBalanceAdjustDialog } from './LeaveBalanceAdjustDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LeaveBalance {
  id: string;
  user_id: string;
  year: number;
  casual_leave_total: number;
  casual_leave_used: number;
  sick_leave_total: number;
  sick_leave_used: number;
  public_holidays_total: number;
  public_holidays_used: number;
  profile?: {
    full_name: string;
    email: string;
  };
}

export function LeaveBalanceTracker() {
  const { user, isAdmin, isHR } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const canViewAll = isAdmin || isHR;
  const canAdjust = isAdmin || isHR;

  const [selectedBalance, setSelectedBalance] = useState<LeaveBalance | null>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');

  const { data: balances, isLoading } = useQuery({
    queryKey: ['leave-balances', currentYear, canViewAll],
    queryFn: async () => {
      let query = supabase
        .from('leave_balances')
        .select('*')
        .eq('year', currentYear);

      // If not admin/HR, only fetch own balance
      if (!canViewAll && user) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles for names
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(b => b.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);

        return data.map(balance => ({
          ...balance,
          profile: profiles?.find(p => p.user_id === balance.user_id),
        })) as LeaveBalance[];
      }

      return [] as LeaveBalance[];
    },
  });

  // Filter balances by search query and selected user
  const filteredBalances = balances?.filter(balance => {
    const matchesSearch = searchQuery === '' || 
      balance.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      balance.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesUser = selectedUserId === 'all' || balance.user_id === selectedUserId;
    
    return matchesSearch && matchesUser;
  });

  const handleAdjustClick = (balance: LeaveBalance) => {
    setSelectedBalance(balance);
    setAdjustDialogOpen(true);
  };

  const handleAdjustSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
  };

  const getLeaveColor = (used: number, total: number) => {
    const percentage = (used / total) * 100;
    if (percentage >= 80) return 'bg-destructive';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-primary';
  };

  const leaveTypes = [
    { 
      key: 'casual', 
      label: 'Casual Leave', 
      icon: Briefcase,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      getUsed: (b: LeaveBalance) => b.casual_leave_used,
      getTotal: (b: LeaveBalance) => b.casual_leave_total,
    },
    { 
      key: 'sick', 
      label: 'Sick Leave', 
      icon: HeartPulse,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      getUsed: (b: LeaveBalance) => b.sick_leave_used,
      getTotal: (b: LeaveBalance) => b.sick_leave_total,
    },
    { 
      key: 'public', 
      label: 'Public Holidays', 
      icon: Flag,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      getUsed: (b: LeaveBalance) => b.public_holidays_used,
      getTotal: (b: LeaveBalance) => b.public_holidays_total,
    },
  ];

  // Summary for all employees (for admin/HR view)
  const summaryData = balances ? leaveTypes.map(type => {
    const totalUsed = balances.reduce((sum, b) => sum + type.getUsed(b), 0);
    const totalAvailable = balances.reduce((sum, b) => sum + type.getTotal(b), 0);
    const remaining = totalAvailable - totalUsed;
    return { ...type, totalUsed, totalAvailable, remaining };
  }) : [];

  // Check for low balance warnings
  const getLowBalanceWarning = (balance: LeaveBalance) => {
    const warnings: string[] = [];
    if (balance.casual_leave_total - balance.casual_leave_used < 3) warnings.push('CL');
    if (balance.sick_leave_total - balance.sick_leave_used < 3) warnings.push('SL');
    if (balance.public_holidays_total - balance.public_holidays_used < 3) warnings.push('PH');
    return warnings;
  };

  return (
    <>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">Leave Balance Tracker</h2>
              <p className="text-sm text-muted-foreground">
                {canViewAll ? 'All employees' : 'Your'} remaining leave days - {currentYear}
              </p>
            </div>
          </div>
          
          {/* Search and Filter Controls */}
          {canViewAll && balances && balances.length > 0 && (
            <div className="flex items-center gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {balances.map(balance => (
                    <SelectItem key={balance.user_id} value={balance.user_id}>
                      {balance.profile?.full_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !balances || balances.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No leave balance data available</p>
          ) : canViewAll ? (
            <>
              {/* Summary Cards for Admin/HR */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {summaryData.map(type => (
                  <div key={type.key} className="p-4 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${type.iconBg}`}>
                        <type.icon className={`h-5 w-5 ${type.iconColor}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{type.label}</p>
                        <p className="text-xs text-muted-foreground">All employees</p>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{type.remaining}</span>
                      <span className="text-sm text-muted-foreground">remaining of {type.totalAvailable}</span>
                    </div>
                    <Progress 
                      value={(type.totalUsed / type.totalAvailable) * 100} 
                      className="mt-2 h-2"
                    />
                  </div>
                ))}
              </div>

              {/* Individual Employee List */}
              <div className="space-y-3 max-h-80 overflow-y-auto">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Individual Balances ({filteredBalances?.length || 0} users)
                </p>
                {filteredBalances?.map((balance) => {
                  const warnings = getLowBalanceWarning(balance);
                  return (
                    <div key={balance.id} className="p-3 rounded-lg border border-border/50 bg-secondary/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{balance.profile?.full_name || 'Unknown'}</p>
                          {warnings.length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                              Low: {warnings.join(', ')}
                            </span>
                          )}
                        </div>
                        {canAdjust && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleAdjustClick(balance)}
                          >
                            <Settings2 className="h-3.5 w-3.5 mr-1" />
                            Adjust
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        {leaveTypes.map(type => {
                          const used = type.getUsed(balance);
                          const total = type.getTotal(balance);
                          const remaining = total - used;
                          return (
                            <div key={type.key} className="text-center">
                              <p className="text-xs text-muted-foreground">{type.label}</p>
                              <p className={`font-bold ${remaining < 3 ? 'text-destructive' : ''}`}>
                                {remaining}/{total}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Single User View */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {balances.map(balance => 
                leaveTypes.map(type => {
                  const used = type.getUsed(balance);
                  const total = type.getTotal(balance);
                  const remaining = total - used;
                  const percentage = (used / total) * 100;
                  
                  return (
                    <div key={type.key} className="p-4 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${type.iconBg}`}>
                          <type.icon className={`h-5 w-5 ${type.iconColor}`} />
                        </div>
                        <p className="font-medium text-sm">{type.label}</p>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className={`text-3xl font-bold ${remaining < 3 ? 'text-destructive' : ''}`}>
                          {remaining}
                        </span>
                        <span className="text-sm text-muted-foreground">of {total} remaining</span>
                      </div>
                      <Progress 
                        value={percentage} 
                        className={`h-2 ${getLeaveColor(used, total)}`}
                      />
                      <p className="text-xs text-muted-foreground mt-2">{used} days used</p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <LeaveBalanceAdjustDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        balance={selectedBalance}
        onSuccess={handleAdjustSuccess}
      />
    </>
  );
}
