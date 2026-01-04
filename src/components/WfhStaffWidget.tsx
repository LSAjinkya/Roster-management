import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Home, User, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface WfhMember {
  id: string;
  name: string;
  department: string;
  email: string;
}

export function WfhStaffWidget() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Fetch today's WFH assignments
  const { data: wfhMembers = [], isLoading } = useQuery({
    queryKey: ['wfh-staff-today', todayStr],
    queryFn: async () => {
      // First get today's assignments that are WFH (work_location_id is null or has WFH type)
      const { data: assignments, error: assignmentsError } = await supabase
        .from('shift_assignments')
        .select('member_id')
        .eq('date', todayStr)
        .is('work_location_id', null);

      if (assignmentsError) throw assignmentsError;

      if (!assignments || assignments.length === 0) {
        // Also check for hybrid members who have WFH today
        const { data: hybridMembers, error: hybridError } = await supabase
          .from('team_members')
          .select('id, name, department, email')
          .eq('is_hybrid', true)
          .eq('status', 'available');

        if (hybridError) throw hybridError;
        return hybridMembers || [];
      }

      const memberIds = assignments.map(a => a.member_id);
      
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('id, name, department, email')
        .in('id', memberIds);

      if (membersError) throw membersError;
      return members || [];
    },
    refetchInterval: 60000,
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-blue-500" />
          <div>
            <h2 className="font-semibold text-lg">Working From Home</h2>
            <p className="text-sm text-muted-foreground">Staff working remotely today</p>
          </div>
        </div>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : wfhMembers.length === 0 ? (
          <div className="text-center py-6">
            <User className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No one working from home today</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {wfhMembers.map((member: WfhMember) => (
              <div 
                key={member.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-blue-500/20 text-blue-700">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.department}</p>
                </div>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 shrink-0">
                  <Home className="h-3 w-3 mr-1" />
                  WFH
                </Badge>
              </div>
            ))}
          </div>
        )}
        {wfhMembers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{wfhMembers.length}</span> staff working from home
            </p>
          </div>
        )}
      </div>
    </div>
  );
}