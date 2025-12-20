import { useState } from 'react';
import { ShiftAssignment, TeamMember } from '@/types/roster';
import { DailyRosterView } from './DailyRosterView';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns';

interface WeeklyRosterViewProps {
  assignments: ShiftAssignment[];
  teamMembers: TeamMember[];
}

export function WeeklyRosterView({ assignments, teamMembers }: WeeklyRosterViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekEnd = addDays(currentWeekStart, 6);
  const isCurrentWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd') === 
                        format(currentWeekStart, 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft size={18} />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextWeek}>
              <ChevronRight size={18} />
            </Button>
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </h2>
            <p className="text-sm text-muted-foreground">Week {format(currentWeekStart, 'w')} of {format(currentWeekStart, 'yyyy')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <Button variant="outline" onClick={goToCurrentWeek} className="gap-2">
              <Calendar size={16} />
              Today
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {weekDays.map((day) => (
          <DailyRosterView
            key={format(day, 'yyyy-MM-dd')}
            date={day}
            assignments={assignments}
            teamMembers={teamMembers}
          />
        ))}
      </div>
    </div>
  );
}
