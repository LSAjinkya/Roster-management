import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, isSameDay, isAfter, isBefore, startOfDay } from 'date-fns';
import { Home, User, Loader2, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface WfhMember {
  id: string;
  name: string;
  department: string;
  email: string;
  date: Date;
}

export function WfhStaffWidget() {
  const today = startOfDay(new Date());
  const endDate = addDays(today, 7);

  // Fetch WFH assignments for next 7 days
  const { data: wfhMembers = [], isLoading } = useQuery({
    queryKey: ['wfh-staff-next-7-days', format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        dates.push(format(addDays(today, i), 'yyyy-MM-dd'));
      }

      // Get assignments where work_location_id is null (WFH)
      const { data: assignments, error: assignmentsError } = await supabase
        .from('shift_assignments')
        .select('member_id, date')
        .in('date', dates)
        .is('work_location_id', null);

      if (assignmentsError) throw assignmentsError;

      if (!assignments || assignments.length === 0) {
        return [];
      }

      const memberIds = [...new Set(assignments.map(a => a.member_id))];
      
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('id, name, department, email')
        .in('id', memberIds);

      if (membersError) throw membersError;

      // Create WFH entries with dates
      const wfhEntries: WfhMember[] = [];
      assignments.forEach(assignment => {
        const member = members?.find(m => m.id === assignment.member_id);
        if (member) {
          wfhEntries.push({
            id: member.id,
            name: member.name,
            department: member.department,
            email: member.email,
            date: new Date(assignment.date)
          });
        }
      });

      // Sort by date
      return wfhEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
    },
    refetchInterval: 60000,
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getDateLabel = (date: Date) => {
    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, addDays(today, 1))) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  // Group by date for display
  const groupedByDate = wfhMembers.reduce((acc, member) => {
    const dateKey = format(member.date, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(member);
    return acc;
  }, {} as Record<string, WfhMember[]>);

  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-blue-500" />
          <div>
            <h2 className="font-semibold text-lg">Working From Home</h2>
            <p className="text-sm text-muted-foreground">Staff working remotely - next 7 days</p>
          </div>
        </div>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : Object.keys(groupedByDate).length === 0 ? (
          <div className="text-center py-6">
            <User className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No one working from home in the next 7 days</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {Object.entries(groupedByDate).map(([dateKey, members]) => (
              <div key={dateKey} className="space-y-2">
                <div className="flex items-center gap-2 sticky top-0 bg-card py-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {getDateLabel(new Date(dateKey))}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {members.length}
                  </Badge>
                </div>
                <div className="space-y-2 pl-6">
                  {members.map((member, idx) => (
                    <div 
                      key={`${member.id}-${dateKey}-${idx}`}
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
              </div>
            ))}
          </div>
        )}
        {wfhMembers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{wfhMembers.length}</span> WFH assignments in next 7 days
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
