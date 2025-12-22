import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TeamGroup, TEAM_GROUPS, DEPARTMENTS, Department } from '@/types/roster';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  team: string | null;
}

interface BulkTeamAssignmentProps {
  teamMembers: TeamMember[];
  onComplete?: () => void;
}

const TEAM_COLORS: Record<TeamGroup, string> = {
  'Alpha': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'Gamma': 'bg-green-500/20 text-green-700 border-green-500/30',
  'Beta': 'bg-orange-500/20 text-orange-700 border-orange-500/30',
};

export function BulkTeamAssignment({ teamMembers, onComplete }: BulkTeamAssignmentProps) {
  const [open, setOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [selectedTeam, setSelectedTeam] = useState<TeamGroup | 'none'>('Alpha');
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredMembers = useMemo(() => {
    let members = teamMembers;
    
    if (departmentFilter !== 'all') {
      members = members.filter(m => m.department === departmentFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      members = members.filter(m => 
        m.name.toLowerCase().includes(query) || 
        m.email.toLowerCase().includes(query)
      );
    }
    
    return members;
  }, [teamMembers, departmentFilter, searchQuery]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
    } else {
      setSelectedMembers(new Set());
    }
  };

  const handleSelectMember = (memberId: string, checked: boolean) => {
    const newSelected = new Set(selectedMembers);
    if (checked) {
      newSelected.add(memberId);
    } else {
      newSelected.delete(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const handleAssign = async () => {
    if (selectedMembers.size === 0) {
      toast.error('Please select at least one member');
      return;
    }

    setLoading(true);
    try {
      const memberIds = Array.from(selectedMembers);
      const teamValue = selectedTeam === 'none' ? null : selectedTeam;
      
      const { error } = await supabase
        .from('team_members')
        .update({ team: teamValue })
        .in('id', memberIds);

      if (error) throw error;

      toast.success(`${memberIds.length} member(s) assigned to ${selectedTeam === 'none' ? 'no team' : selectedTeam}`);
      setSelectedMembers(new Set());
      setOpen(false);
      onComplete?.();
    } catch (error) {
      console.error('Error assigning teams:', error);
      toast.error('Failed to assign teams');
    } finally {
      setLoading(false);
    }
  };

  const teamStats = useMemo(() => {
    const stats: Record<TeamGroup | 'unassigned', number> = {
      'Alpha': 0,
      'Gamma': 0,
      'Beta': 0,
      'unassigned': 0,
    };
    
    teamMembers.forEach(m => {
      if (m.team && TEAM_GROUPS.includes(m.team as TeamGroup)) {
        stats[m.team as TeamGroup]++;
      } else {
        stats['unassigned']++;
      }
    });
    
    return stats;
  }, [teamMembers]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users size={16} />
          Bulk Team Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Bulk Team Assignment</DialogTitle>
          <DialogDescription>
            Assign multiple team members to Alpha, Gamma, or Beta teams at once
          </DialogDescription>
        </DialogHeader>

        {/* Team Stats */}
        <div className="flex flex-wrap gap-3 pb-4 border-b">
          {TEAM_GROUPS.map(team => (
            <div key={team} className="flex items-center gap-2">
              <Badge variant="outline" className={TEAM_COLORS[team]}>
                {team}
              </Badge>
              <span className="text-sm text-muted-foreground">{teamStats[team]}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Badge variant="outline">Unassigned</Badge>
            <span className="text-sm text-muted-foreground">{teamStats['unassigned']}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v as Department | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {DEPARTMENTS.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Select All */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={filteredMembers.length > 0 && selectedMembers.size === filteredMembers.length}
              onCheckedChange={handleSelectAll}
            />
            <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Select All ({filteredMembers.length})
            </Label>
          </div>
          <span className="text-sm text-muted-foreground">
            {selectedMembers.size} selected
          </span>
        </div>

        {/* Member List */}
        <ScrollArea className="h-[300px] border rounded-lg">
          <div className="divide-y">
            {filteredMembers.map(member => (
              <div 
                key={member.id}
                className="flex items-center gap-3 p-3 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedMembers.has(member.id)}
                  onCheckedChange={(checked) => handleSelectMember(member.id, checked as boolean)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.department} • {member.role}
                  </p>
                </div>
                {member.team ? (
                  <Badge variant="outline" className={TEAM_COLORS[member.team as TeamGroup]}>
                    {member.team}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    None
                  </Badge>
                )}
              </div>
            ))}
            {filteredMembers.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No members found matching your filters
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Assign To */}
        <div className="flex items-center gap-4 pt-4 border-t">
          <Label className="font-medium">Assign to:</Label>
          <Select value={selectedTeam} onValueChange={(v) => setSelectedTeam(v as TeamGroup | 'none')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground">No Team</span>
              </SelectItem>
              {TEAM_GROUPS.map(team => (
                <SelectItem key={team} value={team}>
                  <Badge variant="outline" className={TEAM_COLORS[team]}>
                    {team}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading || selectedMembers.size === 0}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              `Assign ${selectedMembers.size} Member(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
