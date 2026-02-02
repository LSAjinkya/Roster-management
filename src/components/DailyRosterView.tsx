import { ShiftAssignment, TeamMember, ShiftType } from '@/types/roster';
import { ShiftCard } from './ShiftCard';
import { format } from 'date-fns';

interface DailyRosterViewProps {
  date: Date;
  assignments: ShiftAssignment[];
  teamMembers: TeamMember[];
}

export function DailyRosterView({ date, assignments, teamMembers }: DailyRosterViewProps) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayAssignments = assignments.filter(a => a.date === dateStr);

  const getShiftMembers = (shiftType: ShiftType): TeamMember[] => {
    const shiftAssignments = dayAssignments.filter(a => a.shiftType === shiftType);
    return shiftAssignments
      .map(a => teamMembers.find(m => m.id === a.memberId))
      .filter((m): m is TeamMember => m !== undefined && m.status !== 'unavailable');
  };

  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl ${
          isToday 
            ? 'bg-primary text-primary-foreground' 
            : isWeekend 
              ? 'bg-muted text-muted-foreground' 
              : 'bg-secondary text-foreground'
        }`}>
          <span className="text-xs font-medium uppercase">{format(date, 'EEE')}</span>
          <span className="text-xl font-bold">{format(date, 'd')}</span>
        </div>
        <div>
          <h3 className="font-semibold text-lg">{format(date, 'EEEE')}</h3>
          <p className="text-sm text-muted-foreground">{format(date, 'MMMM d, yyyy')}</p>
        </div>
        {isToday && (
          <span className="ml-auto px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
            Today
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ShiftCard
          type="morning"
          members={getShiftMembers('morning')}
          date={dateStr}
        />
        <ShiftCard
          type="afternoon"
          members={getShiftMembers('afternoon')}
          date={dateStr}
        />
        <ShiftCard
          type="night"
          members={getShiftMembers('night')}
          date={dateStr}
        />
        <ShiftCard
          type="general"
          members={getShiftMembers('general')}
          date={dateStr}
        />
      </div>
    </div>
  );
}
