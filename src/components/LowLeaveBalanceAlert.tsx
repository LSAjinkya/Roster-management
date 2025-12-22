import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const LOW_BALANCE_THRESHOLD = 3;

interface LowBalanceAlert {
  type: string;
  remaining: number;
  total: number;
}

export function LowLeaveBalanceAlert() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const currentYear = new Date().getFullYear();

  // Load dismissed alerts from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('dismissedLeaveAlerts');
    if (stored) {
      setDismissed(JSON.parse(stored));
    }
  }, []);

  const { data: balance } = useQuery({
    queryKey: ['user-leave-balance-alert', user?.id, currentYear],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', currentYear)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getLowBalanceAlerts = (): LowBalanceAlert[] => {
    if (!balance) return [];

    const alerts: LowBalanceAlert[] = [];

    const casualRemaining = balance.casual_leave_total - balance.casual_leave_used;
    const sickRemaining = balance.sick_leave_total - balance.sick_leave_used;
    const publicRemaining = balance.public_holidays_total - balance.public_holidays_used;

    if (casualRemaining <= LOW_BALANCE_THRESHOLD && casualRemaining >= 0) {
      alerts.push({ 
        type: 'Casual Leave', 
        remaining: casualRemaining, 
        total: balance.casual_leave_total 
      });
    }
    if (sickRemaining <= LOW_BALANCE_THRESHOLD && sickRemaining >= 0) {
      alerts.push({ 
        type: 'Sick Leave', 
        remaining: sickRemaining, 
        total: balance.sick_leave_total 
      });
    }
    if (publicRemaining <= LOW_BALANCE_THRESHOLD && publicRemaining >= 0) {
      alerts.push({ 
        type: 'Public Holidays', 
        remaining: publicRemaining, 
        total: balance.public_holidays_total 
      });
    }

    return alerts.filter(alert => !dismissed.includes(alert.type));
  };

  const handleDismiss = (type: string) => {
    const newDismissed = [...dismissed, type];
    setDismissed(newDismissed);
    sessionStorage.setItem('dismissedLeaveAlerts', JSON.stringify(newDismissed));
  };

  const alerts = getLowBalanceAlerts();

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {alerts.map((alert) => (
        <div
          key={alert.type}
          className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-800/50">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Low {alert.type} Balance
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Only <span className="font-bold">{alert.remaining}</span> of {alert.total} days remaining
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
            onClick={() => handleDismiss(alert.type)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
