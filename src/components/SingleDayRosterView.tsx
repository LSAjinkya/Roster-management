import { useState } from 'react';
import { ShiftAssignment, TeamMember } from '@/types/roster';
import { DailyRosterView } from './DailyRosterView';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addDays, subDays, isToday } from 'date-fns';

interface SingleDayRosterViewProps {
  assignments: ShiftAssignment[];
  teamMembers: TeamMember[];
}

export function SingleDayRosterView({ assignments, teamMembers }: SingleDayRosterViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const goToPreviousDay = () => setCurrentDate(prev => subDays(prev, 1));
  const goToNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const goToToday = () => setCurrentDate(new Date());

  const isTodaySelected = isToday(currentDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousDay}>
              <ChevronLeft size={18} />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextDay}>
              <ChevronRight size={18} />
            </Button>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{format(currentDate, 'EEEE, MMMM d, yyyy')}</h2>
            <p className="text-sm text-muted-foreground">Week {format(currentDate, 'w')} of {format(currentDate, 'yyyy')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isTodaySelected && (
            <Button variant="outline" onClick={goToToday} className="gap-2">
              <Calendar size={16} />
              Today
            </Button>
          )}
        </div>
      </div>

      <DailyRosterView
        date={currentDate}
        assignments={assignments}
        teamMembers={teamMembers}
      />
    </div>
  );
}
