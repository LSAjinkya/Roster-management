import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Users, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, addMonths, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeaveEntry {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  user_name: string;
  department: string | null;
}

const LEAVE_COLORS: Record<string, string> = {
  casual: 'bg-blue-500',
  sick: 'bg-orange-500',
  'comp-off': 'bg-purple-500',
  other: 'bg-gray-500',
};

const LEAVE_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'casual', label: 'Casual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'comp-off', label: 'Comp-Off' },
  { value: 'other', label: 'Other' },
];

export function TeamLeaveCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApprovedLeaves();
    fetchDepartments();
  }, [currentMonth]);

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('department')
      .not('department', 'is', null);
    
    if (data) {
      const uniqueDepts = [...new Set(data.map(d => d.department).filter(Boolean))] as string[];
      setDepartments(uniqueDepts);
    }
  };

  const fetchApprovedLeaves = async () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    try {
      const { data: leaveData, error } = await supabase
        .from('leave_requests')
        .select('id, user_id, start_date, end_date, leave_type')
        .eq('status', 'approved')
        .or(`start_date.lte.${format(monthEnd, 'yyyy-MM-dd')},end_date.gte.${format(monthStart, 'yyyy-MM-dd')}`);

      if (error) throw error;

      // Fetch user names and departments
      const userIds = [...new Set((leaveData || []).map(l => l.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, department')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, { name: p.full_name, department: p.department }]));

      const leavesWithNames = (leaveData || []).map(l => ({
        ...l,
        user_name: profileMap.get(l.user_id)?.name || 'Unknown',
        department: profileMap.get(l.user_id)?.department || null,
      }));

      setLeaves(leavesWithNames);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
  const startDay = monthStart.getDay();

  // Create padding for days before the month starts
  const paddingDays = Array.from({ length: startDay }, (_, i) => null);

  // Filtered leaves based on selections
  const filteredLeaves = useMemo(() => {
    return leaves.filter(leave => {
      const deptMatch = selectedDepartment === 'all' || leave.department === selectedDepartment;
      const typeMatch = selectedLeaveType === 'all' || leave.leave_type === selectedLeaveType;
      return deptMatch && typeMatch;
    });
  }, [leaves, selectedDepartment, selectedLeaveType]);

  const getLeavesForDay = (day: Date) => {
    return filteredLeaves.filter(leave => {
      const start = parseISO(leave.start_date);
      const end = parseISO(leave.end_date);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });
  };

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Leave Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[140px] text-center font-medium">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filters:</span>
            </div>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(selectedDepartment !== 'all' || selectedLeaveType !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSelectedDepartment('all');
                  setSelectedLeaveType('all');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-muted-foreground">Casual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-sm text-muted-foreground">Sick</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-sm text-muted-foreground">Comp-Off</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-sm text-muted-foreground">Other</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}

          {/* Padding days */}
          {paddingDays.map((_, index) => (
            <div key={`pad-${index}`} className="min-h-[100px] p-1 bg-muted/30 rounded" />
          ))}

          {/* Calendar days */}
          {days.map(day => {
            const dayLeaves = getLeavesForDay(day);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[100px] p-1 border rounded transition-colors',
                  isCurrentDay && 'border-primary bg-primary/5',
                  !isCurrentDay && 'border-border hover:bg-muted/50'
                )}
              >
                <div className={cn(
                  'text-sm font-medium mb-1',
                  isCurrentDay && 'text-primary'
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {dayLeaves.slice(0, 3).map(leave => (
                    <div
                      key={leave.id}
                      className={cn(
                        'text-[10px] text-white px-1 py-0.5 rounded truncate',
                        LEAVE_COLORS[leave.leave_type] || LEAVE_COLORS.other
                      )}
                      title={`${leave.user_name} - ${leave.leave_type}`}
                    >
                      {leave.user_name.split(' ')[0]}
                    </div>
                  ))}
                  {dayLeaves.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{dayLeaves.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upcoming leaves list */}
        {filteredLeaves.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Upcoming Leaves This Month</h4>
            <div className="space-y-2">
              {filteredLeaves
                .filter(l => parseISO(l.end_date) >= new Date())
                .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime())
                .slice(0, 5)
                .map(leave => (
                  <div key={leave.id} className="flex items-center gap-3 text-sm">
                    <div className={cn('w-2 h-2 rounded-full', LEAVE_COLORS[leave.leave_type] || LEAVE_COLORS.other)} />
                    <span className="font-medium">{leave.user_name}</span>
                    {leave.department && (
                      <Badge variant="secondary" className="text-xs">{leave.department}</Badge>
                    )}
                    <span className="text-muted-foreground">
                      {format(parseISO(leave.start_date), 'MMM d')} - {format(parseISO(leave.end_date), 'MMM d')}
                    </span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {leave.leave_type}
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}