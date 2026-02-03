import { useState, useMemo, useEffect } from 'react';
import { ShiftAssignment, TeamMember, ShiftType, TEAM_GROUPS, TeamGroup, WorkLocation } from '@/types/roster';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Mail, MapPin, Users, Settings, Phone, Circle, Building2, IdCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { MemberDetailDialog } from './MemberDetailDialog';
import { EmployeeIDCard } from './EmployeeIDCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

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
  const { isAdmin, isHR } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamGroup | 'all'>('all');
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberDetailOpen, setMemberDetailOpen] = useState(false);
  const [idCardDialogOpen, setIdCardDialogOpen] = useState(false);
  const [idCardMember, setIdCardMember] = useState<TeamMember | null>(null);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Fetch work locations
  useEffect(() => {
    const fetchWorkLocations = async () => {
      const { data, error } = await supabase
        .from('work_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching work locations:', error);
        return;
      }

      const locations: WorkLocation[] = (data || []).map(loc => ({
        id: loc.id,
        name: loc.name,
        code: loc.code,
        address: loc.address,
        min_night_shift_count: loc.min_night_shift_count,
        work_from_home_if_below_min: loc.work_from_home_if_below_min,
        is_active: loc.is_active,
        location_type: loc.location_type as WorkLocation['location_type'],
        city: loc.city || undefined,
      }));
      setWorkLocations(locations);
    };

    fetchWorkLocations();
  }, []);

  const handleOpenMemberDetail = (member: TeamMember) => {
    setSelectedMember(member);
    setMemberDetailOpen(true);
  };

  const handleGenerateIDCard = (member: TeamMember) => {
    setIdCardMember(member);
    setIdCardDialogOpen(true);
  };

  const getLocationName = (locationId?: string) => {
    if (!locationId) return 'Not Assigned';
    const loc = workLocations.find(l => l.id === locationId);
    return loc?.name || 'Unknown';
  };

  // Get today's shift for each member
  const getMemberTodayShift = (memberId: string): ShiftType | null => {
    const assignment = assignments.find(a => a.memberId === memberId && a.date === todayStr);
    return assignment?.shiftType || null;
  };

  // Group active members by team (exclude unavailable/left company)
  const membersByTeam = useMemo(() => {
    const groups: Record<TeamGroup | 'Unassigned', TeamMember[]> = {
      'Alpha': [],
      'Beta': [],
      'Gamma': [],
      'Unassigned': [],
    };

    teamMembers
      .filter(member => member.status !== 'unavailable')
      .forEach(member => {
        const team = member.team || 'Unassigned';
        if (team in groups) {
          groups[team as TeamGroup | 'Unassigned'].push(member);
        } else {
          groups['Unassigned'].push(member);
        }
      });

    return groups;
  }, [teamMembers]);

  // Filter out unavailable members (left company) and apply search/team filters
  const activeMembers = useMemo(() => {
    return teamMembers.filter(m => m.status !== 'unavailable');
  }, [teamMembers]);

  // Filter members based on search and selected team
  const filteredMembers = useMemo(() => {
    let members = [...activeMembers];

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
  }, [activeMembers, selectedTeam, searchQuery]);

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
        Showing {filteredMembers.length} of {activeMembers.length} active team members
      </p>

      {/* Team Member Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredMembers.map(member => {
          const todayShift = getMemberTodayShift(member.id);
          const shiftStyle = todayShift ? SHIFT_COLORS[todayShift] : null;
          const location = getLocationName(member.workLocationId);
          const isOnline = member.status === 'available';

          return (
            <Card 
              key={member.id}
              className="group hover:shadow-lg transition-all duration-200 hover:border-primary/20"
            >
              <CardContent className="p-5">
                <div className="flex flex-col items-center text-center">
                  {/* Avatar with Status */}
                  <div className="relative mb-4">
                    <Avatar className="h-20 w-20 ring-2 ring-offset-2 ring-offset-background ring-border">
                      {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
                      <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div 
                      className={cn(
                        "absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-card",
                        isOnline ? 'bg-emerald-500' : 'bg-destructive'
                      )}
                      title={isOnline ? 'Online' : 'Offline'}
                    />
                  </div>

                  {/* Name */}
                  <h3 className="font-semibold text-lg text-foreground mb-1">{member.name}</h3>

                  {/* Role Badge */}
                  <Badge variant="outline" className="mb-2">
                    {member.role}
                  </Badge>

                  {/* Department */}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                    <Building2 size={14} />
                    <span>{member.department}</span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-1.5 text-sm mb-3">
                    <Circle size={8} className={cn("fill-current", isOnline ? 'text-emerald-500' : 'text-destructive')} />
                    <span className={cn("font-medium", isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

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

                  {/* Details Grid */}
                  <div className="w-full space-y-2 pt-3 border-t border-border/50">
                    {/* Email */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail size={14} className="shrink-0" />
                      <span className="truncate" title={member.email}>{member.email}</span>
                    </div>

                    {/* Phone */}
                    {member.phoneNumber && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone size={14} className="shrink-0" />
                        <span>{member.phoneNumber}</span>
                      </div>
                    )}

                    {/* Work Location */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin size={14} className="shrink-0" />
                      <span className="truncate" title={location}>{location}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-border/50 w-full">
                    {(isAdmin || isHR) && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleOpenMemberDetail(member)}
                      >
                        <Settings size={14} className="mr-1.5" />
                        Edit
                      </Button>
                    )}
                    {isAdmin && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleGenerateIDCard(member)}
                      >
                        <IdCard size={14} className="mr-1.5" />
                        ID Card
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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

      {/* Member Detail Dialog */}
      {selectedMember && (
        <MemberDetailDialog
          member={selectedMember}
          open={memberDetailOpen}
          onOpenChange={setMemberDetailOpen}
          workLocations={workLocations}
          allMembers={teamMembers}
        />
      )}

      {/* Employee ID Card Dialog */}
      {idCardMember && (
        <EmployeeIDCard
          open={idCardDialogOpen}
          onOpenChange={setIdCardDialogOpen}
          member={idCardMember}
          workLocation={workLocations.find(l => l.id === idCardMember.workLocationId)}
          avatarUrl={idCardMember.avatarUrl}
        />
      )}
    </div>
  );
}
