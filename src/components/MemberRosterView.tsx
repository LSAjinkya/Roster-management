import { useState } from 'react';
import { ShiftAssignment, TeamMember, ShiftType, SHIFT_DEFINITIONS } from '@/types/roster';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, List, Grid3X3 } from 'lucide-react';
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
} from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RoleBadge } from './RoleBadge';
import { ShiftBadge } from './ShiftBadge';

interface MemberRosterViewProps {
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
  'week-off': 'bg-gray-200',
  'public-off': 'bg-blue-100',
  'paid-leave': 'bg-green-100',
};

const shiftLetters: Record<ShiftType, string> = {
  morning: 'M',
  afternoon: 'A',
  night: 'N',
  general: 'G',
  leave: 'L',
  'comp-off': 'CO',
  'week-off': 'OFF',
  'public-off': 'PO',
  'paid-leave': 'PL',
};

export function MemberRosterView({ assignments, teamMembers }: MemberRosterViewProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(teamMembers[0]?.id || '');
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const selectedMember = teamMembers.find(m => m.id === selectedMemberId);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfWeek = getDay(monthStart);
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(startOfMonth(new Date()));

  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  const getMemberShift = (date: Date): ShiftAssignment | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return assignments.find(a => a.memberId === selectedMemberId && a.date === dateStr);
  };

  const getCoworkers = (date: Date, shiftType: ShiftType): TeamMember[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const shiftAssignments = assignments.filter(
      a => a.date === dateStr && a.shiftType === shiftType && a.memberId !== selectedMemberId
    );
    return shiftAssignments
      .map(a => teamMembers.find(m => m.id === a.memberId))
      .filter((m): m is TeamMember => m !== undefined);
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Calculate stats
  const memberAssignments = assignments.filter(
    a => a.memberId === selectedMemberId && 
    monthDays.some(day => format(day, 'yyyy-MM-dd') === a.date)
  );
  
  const shiftStats = {
    morning: memberAssignments.filter(a => a.shiftType === 'morning').length,
    afternoon: memberAssignments.filter(a => a.shiftType === 'afternoon').length,
    night: memberAssignments.filter(a => a.shiftType === 'night').length,
    general: memberAssignments.filter(a => a.shiftType === 'general').length,
    total: memberAssignments.length,
    offs: monthDays.length - memberAssignments.length,
  };

  return (
    <div className="space-y-6">
      {/* Member Selector & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-4">
          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select team member" />
            </SelectTrigger>
            <SelectContent>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  <div className="flex items-center gap-2">
                    <span>{member.name}</span>
                    <span className="text-xs text-muted-foreground">({member.department})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedMember && (
            <div className="hidden md:flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedMember.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedMember.name}</p>
                <div className="flex items-center gap-2">
                  <RoleBadge role={selectedMember.role} />
                  <span className="text-xs text-muted-foreground">{selectedMember.department}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'calendar' | 'list')}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="calendar" className="gap-1.5">
                <Grid3X3 size={14} />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5">
                <List size={14} />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Month Navigation */}
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
            <p className="text-sm text-muted-foreground">
              {shiftStats.total} working days · {shiftStats.offs} offs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Shift Stats */}
          <div className="hidden md:flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <span className={cn("w-3 h-3 rounded", shiftColors.morning)} />
              {shiftStats.morning}M
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cn("w-3 h-3 rounded", shiftColors.afternoon)} />
              {shiftStats.afternoon}A
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cn("w-3 h-3 rounded", shiftColors.night)} />
              {shiftStats.night}N
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cn("w-3 h-3 rounded", shiftColors.general)} />
              {shiftStats.general}G
            </span>
          </div>
          
          {!isCurrentMonth && (
            <Button variant="outline" onClick={goToCurrentMonth} className="gap-2">
              <Calendar size={16} />
              Today
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'calendar' ? (
        /* Calendar View */
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
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

          <div className="grid grid-cols-7">
            {Array.from({ length: paddingDays }).map((_, i) => (
              <div key={`padding-${i}`} className="min-h-[80px] p-2 bg-muted/30 border-b border-r border-border/30" />
            ))}

            {monthDays.map((day) => {
              const assignment = getMemberShift(day);
              const isWeekend = getDay(day) === 0 || getDay(day) === 6;
              const today = isToday(day);

              return (
                <div
                  key={format(day, 'yyyy-MM-dd')}
                  className={cn(
                    "min-h-[80px] p-2 border-b border-r border-border/30 transition-colors",
                    isWeekend && "bg-muted/20",
                    today && "bg-primary/5 ring-2 ring-primary ring-inset"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-sm font-medium",
                      today && "text-primary font-bold",
                      isWeekend && !today && "text-muted-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  {assignment ? (
                    <div className={cn(
                      "px-2 py-1.5 rounded text-center font-medium text-sm",
                      shiftColors[assignment.shiftType]
                    )}>
                      {shiftLetters[assignment.shiftType]}
                    </div>
                  ) : (
                    <div className="px-2 py-1.5 rounded text-center text-xs text-muted-foreground bg-muted/50">
                      -
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {monthDays.map((day) => {
            const assignment = getMemberShift(day);
            const isWeekend = getDay(day) === 0 || getDay(day) === 6;
            const today = isToday(day);
            const coworkers = assignment ? getCoworkers(day, assignment.shiftType) : [];
            const shiftDef = assignment ? SHIFT_DEFINITIONS.find(s => s.id === assignment.shiftType) : null;

            return (
              <div
                key={format(day, 'yyyy-MM-dd')}
                className={cn(
                  "bg-card rounded-lg border border-border/50 p-4 transition-colors",
                  today && "ring-2 ring-primary",
                  !assignment && "opacity-60"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex flex-col items-center justify-center w-12 h-12 rounded-lg",
                      today ? "bg-primary text-primary-foreground" : 
                      isWeekend ? "bg-muted text-muted-foreground" : "bg-secondary"
                    )}>
                      <span className="text-xs font-medium">{format(day, 'EEE')}</span>
                      <span className="text-lg font-bold">{format(day, 'd')}</span>
                    </div>
                    <div>
                      <p className="font-medium">{format(day, 'EEEE, MMMM d')}</p>
                      {assignment && shiftDef ? (
                        <div className="flex items-center gap-2 mt-1">
                          <ShiftBadge type={assignment.shiftType} showTime />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Weekly Off</p>
                      )}
                    </div>
                  </div>

                  {assignment && coworkers.length > 0 && (
                    <div className="hidden md:block">
                      <p className="text-xs text-muted-foreground mb-1">Coworkers ({coworkers.length})</p>
                      <div className="flex items-center -space-x-2">
                        {coworkers.slice(0, 5).map((member) => (
                          <Avatar key={member.id} className="h-7 w-7 border-2 border-background">
                            <AvatarFallback className="text-xs bg-muted">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {coworkers.length > 5 && (
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
                            +{coworkers.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className={cn("w-4 h-4 rounded", shiftColors.morning)} />
          <span className="text-muted-foreground">Morning (07:00-16:00)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-4 h-4 rounded", shiftColors.afternoon)} />
          <span className="text-muted-foreground">Afternoon (13:00-22:00)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-4 h-4 rounded", shiftColors.night)} />
          <span className="text-muted-foreground">Night (21:00-07:00)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-4 h-4 rounded", shiftColors.general)} />
          <span className="text-muted-foreground">General (10:00-19:00)</span>
        </div>
      </div>
    </div>
  );
}
