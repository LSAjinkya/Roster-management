import { useMemo } from 'react';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TeamMember, ShiftType, Department } from '@/types/roster';
import { SHIFT_ROTATION_ORDER, ROTATING_DEPARTMENTS, WORK_DAYS_IN_CYCLE, OFF_DAYS_IN_CYCLE } from '@/types/shiftRules';
import { ArrowRight, Moon, Sun, Sunrise, Calendar } from 'lucide-react';

interface PreviousMonthState {
  shift: ShiftType;
  workDaysInCurrent: number;
  offDaysUsed: number;
}

interface RotationContinuityPreviewProps {
  teamMembers: TeamMember[];
  previousMonthState: Record<string, PreviousMonthState>;
}

const SHIFT_CONFIG: Record<string, { icon: typeof Sun; color: string; label: string }> = {
  morning: { icon: Sunrise, color: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Morning' },
  afternoon: { icon: Sun, color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Afternoon' },
  night: { icon: Moon, color: 'bg-purple-100 text-purple-700 border-purple-300', label: 'Night' },
  general: { icon: Calendar, color: 'bg-gray-100 text-gray-700 border-gray-300', label: 'General' },
};

export function RotationContinuityPreview({ teamMembers, previousMonthState }: RotationContinuityPreviewProps) {
  const nextMonth = addMonths(new Date(), 1);
  const monthName = format(nextMonth, 'MMMM yyyy');

  // Calculate continuation for each member
  const continuityData = useMemo(() => {
    const rotatingMembers = teamMembers.filter(
      m => ROTATING_DEPARTMENTS.includes(m.department) && m.role !== 'TL' && m.role !== 'Manager'
    );

    return rotatingMembers.map(member => {
      const prevState = previousMonthState[member.id];
      
      if (!prevState) {
        return {
          member,
          hasPreviousData: false,
          currentShift: 'afternoon' as ShiftType,
          workDaysRemaining: WORK_DAYS_IN_CYCLE,
          nextShift: 'afternoon' as ShiftType,
          startsWithOff: false,
          offDaysNeeded: 0,
        };
      }

      const currentShift = prevState.shift;
      const workDaysCompleted = prevState.workDaysInCurrent;
      const workDaysRemaining = WORK_DAYS_IN_CYCLE - workDaysCompleted;
      
      // If they've completed 5+ work days, they need OFF days next
      const needsOff = workDaysCompleted >= WORK_DAYS_IN_CYCLE;
      const offDaysNeeded = needsOff ? (member.weekOffEntitlement || 2) - prevState.offDaysUsed : 0;
      
      // Calculate next shift after OFF
      const currentShiftIndex = SHIFT_ROTATION_ORDER.indexOf(currentShift as any);
      const nextShiftAfterOff = needsOff 
        ? SHIFT_ROTATION_ORDER[(currentShiftIndex + 1) % 3]
        : currentShift;

      return {
        member,
        hasPreviousData: true,
        currentShift,
        workDaysCompleted,
        workDaysRemaining: needsOff ? 0 : workDaysRemaining,
        nextShift: nextShiftAfterOff,
        startsWithOff: needsOff && offDaysNeeded > 0,
        offDaysNeeded: Math.max(0, offDaysNeeded),
      };
    });
  }, [teamMembers, previousMonthState]);

  const membersWithData = continuityData.filter(d => d.hasPreviousData);
  const membersWithoutData = continuityData.filter(d => !d.hasPreviousData);
  const membersStartingWithOff = continuityData.filter(d => d.startsWithOff);
  const membersContinuingWork = continuityData.filter(d => d.hasPreviousData && !d.startsWithOff);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-primary" />
          Rotation Continuity Preview for {monthName}
        </CardTitle>
        <CardDescription>
          Shows how each member's rotation will continue from the previous month
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{membersWithData.length}</div>
            <div className="text-xs text-muted-foreground">With Previous Data</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{membersWithoutData.length}</div>
            <div className="text-xs text-muted-foreground">Fresh Start</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{membersContinuingWork.length}</div>
            <div className="text-xs text-muted-foreground">Continue Work</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{membersStartingWithOff.length}</div>
            <div className="text-xs text-muted-foreground">Start with OFF</div>
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {continuityData.map(data => {
              const ShiftIcon = SHIFT_CONFIG[data.currentShift]?.icon || Sun;
              const NextShiftIcon = SHIFT_CONFIG[data.nextShift]?.icon || Sun;
              
              return (
                <div
                  key={data.member.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-32 truncate font-medium text-sm">
                      {data.member.name}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {data.member.department}
                    </Badge>
                  </div>

                  {data.hasPreviousData ? (
                    <div className="flex items-center gap-2">
                      {/* Current State */}
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${SHIFT_CONFIG[data.currentShift]?.color || ''}`}>
                        <ShiftIcon className="h-3 w-3" />
                        <span>{SHIFT_CONFIG[data.currentShift]?.label}</span>
                        <span className="text-muted-foreground ml-1">
                          (Day {data.workDaysCompleted}/{WORK_DAYS_IN_CYCLE})
                        </span>
                      </div>

                      <ArrowRight className="h-4 w-4 text-muted-foreground" />

                      {/* Feb 1 State */}
                      {data.startsWithOff ? (
                        <Badge variant="secondary" className="text-xs bg-gray-200">
                          OFF × {data.offDaysNeeded}
                        </Badge>
                      ) : (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${SHIFT_CONFIG[data.nextShift]?.color || ''}`}>
                          <NextShiftIcon className="h-3 w-3" />
                          <span>{SHIFT_CONFIG[data.nextShift]?.label}</span>
                          <span className="text-muted-foreground ml-1">
                            (Day {(data.workDaysCompleted || 0) + 1})
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                      No previous data - Starting fresh with Afternoon
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
