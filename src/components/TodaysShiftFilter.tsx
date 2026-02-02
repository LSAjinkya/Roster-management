import { useMemo, useState } from 'react';
import { ShiftBadge } from './ShiftBadge';
import { SHIFT_DEFINITIONS, TeamMember, ShiftType } from '@/types/roster';
import { cn } from '@/lib/utils';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TodaysShiftFilterProps {
  todayAssignments: Array<{ member_id: string; shift_type: string }>;
  teamMembers: Array<{ id: string; name: string; department: string; status: string; role: string }>;
}

export function TodaysShiftFilter({ todayAssignments, teamMembers }: TodaysShiftFilterProps) {
  const [selectedShift, setSelectedShift] = useState<ShiftType | 'all'>('all');
  const [expanded, setExpanded] = useState(false);

  // Get active team members (exclude unavailable/left company)
  const activeMembers = useMemo(() => {
    return teamMembers.filter(m => m.status !== 'unavailable');
  }, [teamMembers]);

  // Count members per shift type today
  const shiftCounts = useMemo(() => {
    return SHIFT_DEFINITIONS.reduce((acc, shift) => {
      acc[shift.id] = todayAssignments.filter(a => a.shift_type === shift.id).length;
      return acc;
    }, {} as Record<string, number>);
  }, [todayAssignments]);

  // Get members for selected shift
  const membersForSelectedShift = useMemo(() => {
    if (selectedShift === 'all') {
      return [];
    }
    
    const memberIds = todayAssignments
      .filter(a => a.shift_type === selectedShift)
      .map(a => a.member_id);
    
    return activeMembers
      .filter(m => memberIds.includes(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedShift, todayAssignments, activeMembers]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleShiftClick = (shiftId: ShiftType) => {
    if (selectedShift === shiftId) {
      setSelectedShift('all');
      setExpanded(false);
    } else {
      setSelectedShift(shiftId);
      setExpanded(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Shift Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SHIFT_DEFINITIONS.map(shift => {
          const isSelected = selectedShift === shift.id;
          return (
            <div 
              key={shift.id} 
              onClick={() => handleShiftClick(shift.id as ShiftType)}
              className={cn(
                "p-4 rounded-xl border-2 transition-all cursor-pointer hover:scale-[1.02]",
                shift.color,
                isSelected && "ring-2 ring-primary ring-offset-2"
              )}
            >
              <ShiftBadge type={shift.id} size="sm" />
              <p className="text-3xl font-bold mt-3">{shiftCounts[shift.id]}</p>
              <p className="text-sm opacity-75 mt-1">{shift.startTime} - {shift.endTime}</p>
              {isSelected && (
                <Badge variant="secondary" className="mt-2 gap-1">
                  <Users size={12} />
                  View Staff
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded Member List */}
      {selectedShift !== 'all' && expanded && (
        <div className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
          <div className="p-3 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-muted-foreground" />
              <span className="font-medium text-sm">
                {membersForSelectedShift.length} staff on{' '}
                {SHIFT_DEFINITIONS.find(s => s.id === selectedShift)?.name} shift today
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedShift('all');
                setExpanded(false);
              }}
              className="h-7 px-2"
            >
              <ChevronUp size={14} />
              Close
            </Button>
          </div>
          
          {membersForSelectedShift.length > 0 ? (
            <ScrollArea className="max-h-[240px]">
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {membersForSelectedShift.map(member => (
                  <div 
                    key={member.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-background/50 hover:bg-background transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-background",
                        member.status === 'available' ? 'bg-green-500' : 'bg-red-500'
                      )} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {member.department} • {member.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No staff assigned to this shift today
            </div>
          )}
        </div>
      )}
    </div>
  );
}
