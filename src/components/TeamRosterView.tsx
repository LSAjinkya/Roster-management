import { useState, useMemo } from 'react';
import { ShiftAssignment, TeamMember, ShiftType, TEAM_GROUPS, TeamGroup } from '@/types/roster';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Mail, MapPin, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TeamRosterViewProps {
  assignments: ShiftAssignment[];
  teamMembers: TeamMember[];
}

const TEAM_COLORS: Record<TeamGroup, string> = {
  'Alpha': 'bg-blue-500',
  'Beta': 'bg-purple-500',
  'Gamma': 'bg-emerald-500',
};

const SHIFT_COLORS: Record<ShiftType, { bg: string; text: string }> = {
  'morning': { bg: 'bg-shift-morning', text: 'text-amber-900' },
  'afternoon': { bg: 'bg-shift-afternoon', text: 'text-blue-900' },
  'night': { bg: 'bg-shift-night', text: 'text-purple-100' },
  'general': { bg: 'bg-shift-general', text: 'text-green-900' },
  'leave': { bg: 'bg-red-100', text: 'text-red-900' },
  'comp-off': { bg: 'bg-orange-100', text: 'text-orange-900' },
  'week-off': { bg: 'bg-muted', text: 'text-muted-foreground' },
  'public-off': { bg: 'bg-blue-100', text: 'text-blue-900' },
  'paid-leave': { bg: 'bg-green-100', text: 'text-green-900' },
};

// Team to shift mapping for today
const TEAM_SHIFT_TODAY: Record<TeamGroup, ShiftType> = {
  'Alpha': 'morning',
  'Beta': 'afternoon', 
  'Gamma': 'night',
};

export function TeamRosterView({ assignments, teamMembers }: TeamRosterViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamGroup | 'all'>('all');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Get today's shift for each member
  const getMemberTodayShift = (memberId: string): ShiftType | null => {
    const assignment = assignments.find(a => a.memberId === memberId && a.date === todayStr);
    return assignment?.shiftType || null;
  };

  // Group members by team
  const membersByTeam = useMemo(() => {
    const groups: Record<TeamGroup | 'Unassigned', TeamMember[]> = {
      'Alpha': [],
      'Beta': [],
      'Gamma': [],
      'Unassigned': [],
    };

    teamMembers.forEach(member => {
      const team = member.team || 'Unassigned';
      if (team in groups) {
        groups[team as TeamGroup | 'Unassigned'].push(member);
      } else {
        groups['Unassigned'].push(member);
      }
    });

    return groups;
  }, [teamMembers]);

  // Filter members based on search and selected team
  const filteredMembers = useMemo(() => {
    let members = [...teamMembers];

    if (selectedTeam !== 'all') {
      members = members.filter(m => m.team === selectedTeam);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      members = members.filter(m => 
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        m.department.toLowerCase().includes(query) ||
        m.role.toLowerCase().includes(query)
      );
    }

    return members;
  }, [teamMembers, selectedTeam, searchQuery]);

  // Calculate team stats
  const teamStats = useMemo(() => {
    return TEAM_GROUPS.map(team => ({
      team,
      count: membersByTeam[team].length,
      shift: TEAM_SHIFT_TODAY[team],
    }));
  }, [membersByTeam]);

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex justify-center">
        <div className="relative w-full max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border/50"
          />
        </div>
      </div>

      {/* Team Filter Tabs */}
      <div className="flex justify-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedTeam('all')}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-colors",
            selectedTeam === 'all' 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted hover:bg-muted/80 text-foreground"
          )}
        >
          All
        </button>
        {TEAM_GROUPS.map(team => (
          <button
            key={team}
            onClick={() => setSelectedTeam(team)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
              selectedTeam === team 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted hover:bg-muted/80 text-foreground"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", TEAM_COLORS[team])} />
            {team}
            <Badge variant="secondary" className="ml-1 text-xs">
              {membersByTeam[team].length}
            </Badge>
          </button>
        ))}
      </div>

      {/* Team Shift Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {teamStats.map(({ team, count, shift }) => (
          <div 
            key={team}
            className={cn(
              "p-4 rounded-xl border border-border/50 transition-all",
              selectedTeam === team && "ring-2 ring-primary",
              SHIFT_COLORS[shift].bg
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", TEAM_COLORS[team])} />
                <span className={cn("font-semibold", SHIFT_COLORS[shift].text)}>
                  Team {team}
                </span>
              </div>
              <Badge variant="outline" className={SHIFT_COLORS[shift].text}>
                {shift.charAt(0).toUpperCase() + shift.slice(1)} Shift
              </Badge>
            </div>
            <div className={cn("flex items-center gap-1 mt-2 text-sm", SHIFT_COLORS[shift].text)}>
              <Users size={14} />
              <span>{count} members</span>
            </div>
          </div>
        ))}
      </div>

      {/* Members Count */}
      <p className="text-center text-sm text-muted-foreground">
        Showing {filteredMembers.length} of {teamMembers.length} team members
      </p>

      {/* Team Member Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredMembers.map(member => {
          const todayShift = getMemberTodayShift(member.id);
          const shiftStyle = todayShift ? SHIFT_COLORS[todayShift] : null;

          return (
            <div 
              key={member.id}
              className="bg-card rounded-xl border border-border/50 p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow"
            >
              {/* Avatar with status indicator */}
              <div className="relative mb-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-card",
                  member.status === 'available' ? 'bg-green-500' : 
                  member.status === 'on-leave' ? 'bg-amber-500' : 'bg-gray-400'
                )} />
              </div>

              {/* Name */}
              <h3 className="font-semibold text-lg text-foreground">{member.name}</h3>
              
              {/* Role */}
              <p className="text-sm text-muted-foreground mb-2">{member.role}</p>

              {/* Department Badge */}
              <Badge variant="secondary" className="mb-3">
                {member.department}
              </Badge>

              {/* Team Badge if assigned */}
              {member.team && (
                <div className="flex items-center gap-1.5 mb-3">
                  <div className={cn("w-2 h-2 rounded-full", TEAM_COLORS[member.team])} />
                  <span className="text-xs text-muted-foreground">Team {member.team}</span>
                  {todayShift && shiftStyle && (
                    <Badge className={cn("ml-2 text-xs", shiftStyle.bg, shiftStyle.text)}>
                      {todayShift.charAt(0).toUpperCase()}
                    </Badge>
                  )}
                </div>
              )}

              {/* Email */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Mail size={14} />
                <span className="truncate max-w-[180px]">{member.email}</span>
              </div>

              {/* Location/Department Icon */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin size={14} />
                <span>{member.department}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredMembers.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No team members found</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  );
}
