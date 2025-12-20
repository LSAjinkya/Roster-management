import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PendingItem {
  id: string;
  type: 'leave' | 'swap';
  user_name: string;
  created_at: string;
  details: string;
}

export function NotificationBell() {
  const { canEditShifts } = useAuth();
  const [pendingLeaves, setPendingLeaves] = useState<PendingItem[]>([]);
  const [pendingSwaps, setPendingSwaps] = useState<PendingItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (canEditShifts) {
      fetchPendingItems();

      // Real-time subscription
      const leaveChannel = supabase
        .channel('pending-notifications-leaves')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'leave_requests' },
          () => fetchPendingItems()
        )
        .subscribe();

      const swapChannel = supabase
        .channel('pending-notifications-swaps')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'swap_requests' },
          () => fetchPendingItems()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(leaveChannel);
        supabase.removeChannel(swapChannel);
      };
    }
  }, [canEditShifts]);

  const fetchPendingItems = async () => {
    // Fetch pending leave requests
    const { data: leaveData } = await supabase
      .from('leave_requests')
      .select('id, user_id, created_at, start_date, end_date, leave_type')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch pending swap requests
    const { data: swapData } = await supabase
      .from('swap_requests')
      .select('id, requester_id, created_at, date')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get user IDs for profile lookup
    const leaveUserIds = (leaveData || []).map(l => l.user_id);
    const swapUserIds = (swapData || []).map(s => s.requester_id);

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', [...new Set([...leaveUserIds])]);

    // Fetch team members for swap requests
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('id, name')
      .in('id', swapUserIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
    const teamMemberMap = new Map((teamMembers || []).map(t => [t.id, t.name]));

    // Map leave requests
    const leaves: PendingItem[] = (leaveData || []).map(l => ({
      id: l.id,
      type: 'leave' as const,
      user_name: profileMap.get(l.user_id) || 'Unknown',
      created_at: l.created_at,
      details: `${format(new Date(l.start_date), 'MMM d')} - ${format(new Date(l.end_date), 'MMM d')}`,
    }));

    // Map swap requests
    const swaps: PendingItem[] = (swapData || []).map(s => ({
      id: s.id,
      type: 'swap' as const,
      user_name: teamMemberMap.get(s.requester_id) || 'Unknown',
      created_at: s.created_at,
      details: format(new Date(s.date), 'MMM d, yyyy'),
    }));

    setPendingLeaves(leaves);
    setPendingSwaps(swaps);
  };

  if (!canEditShifts) {
    return null;
  }

  const totalPending = pendingLeaves.length + pendingSwaps.length;
  const allItems = [...pendingLeaves, ...pendingSwaps].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={20} />
          {totalPending > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground"
            >
              {totalPending > 9 ? '9+' : totalPending}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">Pending Approvals</h4>
          <p className="text-xs text-muted-foreground">
            {totalPending} {totalPending === 1 ? 'item' : 'items'} awaiting review
          </p>
        </div>
        <ScrollArea className="max-h-[300px]">
          {allItems.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No pending approvals
            </div>
          ) : (
            <div className="divide-y">
              {allItems.map(item => (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={item.type === 'leave' ? '/leave-requests' : '/shifts'}
                  onClick={() => setOpen(false)}
                  className="block p-3 hover:bg-muted transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full mt-1.5 shrink-0',
                        item.type === 'leave' ? 'bg-blue-500' : 'bg-purple-500'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.user_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.type === 'leave' ? 'Leave request' : 'Shift swap'} • {item.details}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {item.type === 'leave' ? 'Leave' : 'Swap'}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
        {totalPending > 0 && (
          <div className="p-2 border-t">
            <Link
              to="/leave-requests"
              onClick={() => setOpen(false)}
              className="block w-full"
            >
              <Button variant="ghost" size="sm" className="w-full text-xs">
                View all pending requests
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
