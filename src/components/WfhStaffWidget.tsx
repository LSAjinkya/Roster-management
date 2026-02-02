import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { Home, User, Loader2, Calendar, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WfhEntry {
  id: string;
  name: string;
  department: string;
  email: string;
  date: Date;
  reason: 'hybrid' | 'wfh_shift' | 'single_night';
}

export function WfhStaffWidget() {
  const today = startOfDay(new Date());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set([format(today, 'yyyy-MM-dd')]));
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Fetch departments for filter
  const { data: departments = [] } = useQuery({
    queryKey: ['wfh-departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch WFH entries for next 7 days based on multiple conditions
  const { data: wfhEntries = [], isLoading } = useQuery({
    queryKey: ['wfh-staff-next-7-days', format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        dates.push(format(addDays(today, i), 'yyyy-MM-dd'));
      }
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];

      // Fetch all required data in parallel
      const [shiftAssignmentsResult, teamMembersResult, workLocationsResult] = await Promise.all([
        // Get all shift assignments for the date range
        supabase
          .from('shift_assignments')
          .select('id, member_id, date, shift_type, work_location_id')
          .gte('date', startDate)
          .lte('date', endDate),
        
        // Get all team members with hybrid settings
        supabase
          .from('team_members')
          .select('id, name, department, email, is_hybrid, hybrid_wfh_days, hybrid_wfh_days_pattern')
          .neq('status', 'unavailable'),
        
        // Get work locations with min night shift settings
        supabase
          .from('work_locations')
          .select('id, name, min_night_shift_count, work_from_home_if_below_min')
          .eq('is_active', true),
      ]);

      if (shiftAssignmentsResult.error) throw shiftAssignmentsResult.error;
      if (teamMembersResult.error) throw teamMembersResult.error;
      if (workLocationsResult.error) throw workLocationsResult.error;

      const shiftAssignments = shiftAssignmentsResult.data || [];
      const teamMembers = teamMembersResult.data || [];
      const workLocations = workLocationsResult.data || [];

      // Create member lookup map
      const memberMap = new Map(teamMembers.map(m => [m.id, m]));
      
      // Create work location lookup
      const locationMap = new Map(workLocations.map(l => [l.id, l]));

      const wfhList: WfhEntry[] = [];
      const addedEntries = new Set<string>(); // Track unique member+date combinations

      const addEntry = (memberId: string, date: Date, reason: WfhEntry['reason']) => {
        const member = memberMap.get(memberId);
        if (!member) return;
        
        const key = `${memberId}-${format(date, 'yyyy-MM-dd')}`;
        if (addedEntries.has(key)) return;
        addedEntries.add(key);

        wfhList.push({
          id: member.id,
          name: member.name,
          department: member.department,
          email: member.email,
          date,
          reason,
        });
      };

      // Process each date
      dates.forEach(dateStr => {
        const date = new Date(dateStr);
        const dayAssignments = shiftAssignments.filter(a => a.date === dateStr);

        // Condition 1: Check for single person on night shift at each location
        const nightShiftsByLocation = new Map<string | null, typeof dayAssignments>();
        dayAssignments
          .filter(a => a.shift_type === 'night')
          .forEach(a => {
            const locId = a.work_location_id;
            if (!nightShiftsByLocation.has(locId)) {
              nightShiftsByLocation.set(locId, []);
            }
            nightShiftsByLocation.get(locId)!.push(a);
          });

        // For each location, if night shift count is below minimum, those people get WFH
        nightShiftsByLocation.forEach((assignments, locationId) => {
          if (locationId) {
            const location = locationMap.get(locationId);
            if (location && location.work_from_home_if_below_min) {
              const minCount = location.min_night_shift_count || 2;
              if (assignments.length < minCount) {
                assignments.forEach(a => addEntry(a.member_id, date, 'single_night'));
              }
            }
          } else {
            // No location assigned - if single person, they get WFH
            if (assignments.length === 1) {
              addEntry(assignments[0].member_id, date, 'single_night');
            }
          }
        });

        // Condition 2a: Explicit WFH shift assignments
        dayAssignments
          .filter(a => a.shift_type.toLowerCase() === 'wfh')
          .forEach(a => addEntry(a.member_id, date, 'wfh_shift'));
      });

      // Condition 2b: Hybrid workers based on their custom day pattern or fallback to count
      teamMembers
        .filter(m => m.is_hybrid && ((m.hybrid_wfh_days_pattern && m.hybrid_wfh_days_pattern.length > 0) || (m.hybrid_wfh_days || 0) > 0))
        .forEach(member => {
          const wfhPattern = member.hybrid_wfh_days_pattern as number[] | null;
          
          dates.forEach(dateStr => {
            const date = new Date(dateStr);
            const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
            
            // Skip weekends
            if (dayOfWeek === 0 || dayOfWeek === 6) return;
            
            let isWfhDay = false;
            
            // Use custom pattern if available
            if (wfhPattern && wfhPattern.length > 0) {
              isWfhDay = wfhPattern.includes(dayOfWeek);
            } else {
              // Fallback to old count-based logic
              const wfhDaysPerWeek = member.hybrid_wfh_days || 0;
              if (wfhDaysPerWeek >= 5) {
                isWfhDay = dayOfWeek >= 1 && dayOfWeek <= 5;
              } else if (wfhDaysPerWeek === 4) {
                isWfhDay = dayOfWeek >= 1 && dayOfWeek <= 4;
              } else if (wfhDaysPerWeek === 3) {
                isWfhDay = dayOfWeek >= 1 && dayOfWeek <= 3;
              } else if (wfhDaysPerWeek === 2) {
                isWfhDay = dayOfWeek === 1 || dayOfWeek === 2;
              } else if (wfhDaysPerWeek === 1) {
                isWfhDay = dayOfWeek === 1;
              }
            }
            
            if (isWfhDay) {
              addEntry(member.id, date, 'hybrid');
            }
          });
        });

      // Sort by date
      return wfhList.sort((a, b) => a.date.getTime() - b.date.getTime());
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

  const getReasonBadge = (reason: WfhEntry['reason']) => {
    switch (reason) {
      case 'single_night':
        return (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 shrink-0 text-xs">
            Night Solo
          </Badge>
        );
      case 'wfh_shift':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 shrink-0 text-xs">
            Assigned
          </Badge>
        );
      case 'hybrid':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 shrink-0 text-xs">
            Hybrid
          </Badge>
        );
    }
  };

  const toggleDay = (dateKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  // Filter by department
  const filteredEntries = departmentFilter === 'all' 
    ? wfhEntries 
    : wfhEntries.filter(m => m.department === departmentFilter);

  // Group by date for display
  const groupedByDate = filteredEntries.reduce((acc, entry) => {
    const dateKey = format(entry.date, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, WfhEntry[]>);

  // Sort dates chronologically
  const sortedDates = Object.keys(groupedByDate).sort();

  // Get unique departments from WFH entries for filter
  const wfhDepartments = [...new Set(wfhEntries.map(m => m.department))].sort();

  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-blue-500" />
            <div>
              <h2 className="font-semibold text-lg">Working From Home</h2>
              <p className="text-sm text-muted-foreground">WFH schedule - next 7 days</p>
            </div>
          </div>
          
          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {wfhDepartments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-6">
            <User className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {departmentFilter === 'all' 
                ? 'No staff working from home in the next 7 days'
                : `No staff from ${departmentFilter} working from home`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {sortedDates.map((dateKey) => {
              const entries = groupedByDate[dateKey];
              const isExpanded = expandedDays.has(dateKey);
              const isToday = dateKey === format(today, 'yyyy-MM-dd');

              return (
                <Collapsible
                  key={dateKey}
                  open={isExpanded}
                  onOpenChange={() => toggleDay(dateKey)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                      isToday 
                        ? 'bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30' 
                        : 'bg-secondary/50 hover:bg-secondary'
                    }`}>
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Calendar className={`h-4 w-4 ${isToday ? 'text-blue-500' : 'text-muted-foreground'}`} />
                        <span className={`font-medium ${isToday ? 'text-blue-600' : ''}`}>
                          {getDateLabel(new Date(dateKey))}
                        </span>
                      </div>
                      <Badge 
                        variant={isToday ? "default" : "secondary"} 
                        className={isToday ? "bg-blue-500 text-white" : ""}
                      >
                        {entries.length} {entries.length === 1 ? 'person' : 'people'}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-1 pl-4 border-l-2 border-border ml-5">
                      {entries.map((entry, idx) => (
                        <div 
                          key={`${entry.id}-${dateKey}-${idx}`}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-blue-500/20 text-blue-700">
                              {getInitials(entry.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{entry.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{entry.department}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getReasonBadge(entry.reason)}
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 shrink-0">
                              <Home className="h-3 w-3 mr-1" />
                              WFH
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
        {filteredEntries.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{filteredEntries.length}</span> WFH days scheduled
              {departmentFilter !== 'all' && ` for ${departmentFilter}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
