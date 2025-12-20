import { useState } from 'react';
import { ShiftAssignment, TeamMember, ShiftType } from '@/types/roster';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  subMonths,
  isSameMonth,
  isToday,
  getDay,
  startOfWeek
} from 'date-fns';
import { cn } from '@/lib/utils';

interface MonthlyRosterViewProps {
  assignments: ShiftAssignment[];
  teamMembers: TeamMember[];
}

const shiftColors: Record<ShiftType, string> = {
  morning: 'bg-shift-morning',
  afternoon: 'bg-shift-afternoon',
  night: 'bg-shift-night',
  general: 'bg-shift-general',
  leave: 'bg-red-100',
  'comp-off': 'bg-orange-100',
};

export function MonthlyRosterView({ assignments, teamMembers }: MonthlyRosterViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate padding days for the first week
  const firstDayOfWeek = getDay(monthStart);
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Monday start

  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(startOfMonth(new Date()));

  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  const getDayStats = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAssignments = assignments.filter(a => a.date === dateStr);
    
    const shiftCounts: Record<ShiftType, number> = {
      morning: dayAssignments.filter(a => a.shiftType === 'morning').length,
      afternoon: dayAssignments.filter(a => a.shiftType === 'afternoon').length,
      night: dayAssignments.filter(a => a.shiftType === 'night').length,
      general: dayAssignments.filter(a => a.shiftType === 'general').length,
      leave: dayAssignments.filter(a => a.shiftType === 'leave').length,
      'comp-off': dayAssignments.filter(a => a.shiftType === 'comp-off').length,
    };

    return { total: dayAssignments.length, shiftCounts };
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft size={18} />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight size={18} />
            </Button>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <p className="text-sm text-muted-foreground">{monthDays.length} days</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <Button variant="outline" onClick={goToCurrentMonth} className="gap-2">
              <Calendar size={16} />
              Today
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-border/50">
          {weekDays.map((day) => (
            <div 
              key={day} 
              className="p-3 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {/* Padding cells */}
          {Array.from({ length: paddingDays }).map((_, i) => (
            <div key={`padding-${i}`} className="min-h-[100px] p-2 bg-muted/30 border-b border-r border-border/30" />
          ))}

          {/* Month days */}
          {monthDays.map((day) => {
            const stats = getDayStats(day);
            const isWeekend = getDay(day) === 0 || getDay(day) === 6;
            const today = isToday(day);

            return (
              <div
                key={format(day, 'yyyy-MM-dd')}
                className={cn(
                  "min-h-[100px] p-2 border-b border-r border-border/30 transition-colors",
                  isWeekend && "bg-muted/20",
                  today && "bg-primary/5 ring-2 ring-primary ring-inset"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-sm font-medium",
                    today && "text-primary font-bold",
                    isWeekend && !today && "text-muted-foreground"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {stats.total > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {stats.total} staff
                    </span>
                  )}
                </div>

                {/* Shift indicators */}
                <div className="flex flex-wrap gap-1">
                  {stats.shiftCounts.morning > 0 && (
                    <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-xs", shiftColors.morning)}>
                      <span className="font-medium">{stats.shiftCounts.morning}</span>
                      <span className="hidden sm:inline">M</span>
                    </div>
                  )}
                  {stats.shiftCounts.afternoon > 0 && (
                    <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-xs", shiftColors.afternoon)}>
                      <span className="font-medium">{stats.shiftCounts.afternoon}</span>
                      <span className="hidden sm:inline">A</span>
                    </div>
                  )}
                  {stats.shiftCounts.night > 0 && (
                    <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-xs", shiftColors.night)}>
                      <span className="font-medium">{stats.shiftCounts.night}</span>
                      <span className="hidden sm:inline">N</span>
                    </div>
                  )}
                  {stats.shiftCounts.general > 0 && (
                    <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-xs", shiftColors.general)}>
                      <span className="font-medium">{stats.shiftCounts.general}</span>
                      <span className="hidden sm:inline">G</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className={cn("w-4 h-4 rounded", shiftColors.morning)} />
          <span className="text-muted-foreground">Morning</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-4 h-4 rounded", shiftColors.afternoon)} />
          <span className="text-muted-foreground">Afternoon</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-4 h-4 rounded", shiftColors.night)} />
          <span className="text-muted-foreground">Night</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-4 h-4 rounded", shiftColors.general)} />
          <span className="text-muted-foreground">General</span>
        </div>
      </div>
    </div>
  );
}
