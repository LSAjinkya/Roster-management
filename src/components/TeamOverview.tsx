import { useState } from 'react';
import { TeamMember, Department, Role, DEPARTMENTS, ROLES } from '@/types/roster';
import { TeamMemberCard } from './TeamMemberCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Users, Grid, List, LayoutGrid } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface TeamOverviewProps {
  members: TeamMember[];
}

const ROLE_COLORS: Record<Role, string> = {
  'TL': 'bg-primary/20 text-primary border-primary/30',
  'L2': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'L1': 'bg-green-500/20 text-green-700 border-green-500/30',
  'HR': 'bg-purple-500/20 text-purple-700 border-purple-500/30',
};

const ROLE_LABELS: Record<Role, string> = {
  'TL': 'Team Leads',
  'L2': 'Level 2',
  'L1': 'Level 1',
  'HR': 'HR Team',
};

export function TeamOverview({ members }: TeamOverviewProps) {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'roles'>('roles');

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(search.toLowerCase()) ||
                         member.email.toLowerCase().includes(search.toLowerCase());
    const matchesDepartment = departmentFilter === 'all' || member.department === departmentFilter;
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesDepartment && matchesRole;
  });

  const departmentCounts = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = members.filter(m => m.department === dept).length;
    return acc;
  }, {} as Record<Department, number>);

  const roleCounts = ROLES.reduce((acc, role) => {
    acc[role] = members.filter(m => m.role === role).length;
    return acc;
  }, {} as Record<Role, number>);

  // Group members by role for roles view
  const membersByRole = ROLES.reduce((acc, role) => {
    acc[role] = filteredMembers.filter(m => m.role === role);
    return acc;
  }, {} as Record<Role, TeamMember[]>);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {DEPARTMENTS.map(dept => (
          <div 
            key={dept} 
            className={`bg-card p-3 rounded-lg border cursor-pointer transition-all ${
              departmentFilter === dept 
                ? 'border-primary bg-primary/5' 
                : 'border-border/50 hover:border-primary/30'
            }`}
            onClick={() => setDepartmentFilter(departmentFilter === dept ? 'all' : dept)}
          >
            <p className="text-xs text-muted-foreground truncate">{dept}</p>
            <p className="text-xl font-bold mt-1">{departmentCounts[dept]}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v as Department | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Departments</SelectItem>
              {DEPARTMENTS.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | 'all')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Roles</SelectItem>
              {ROLES.map(role => (
                <SelectItem key={role} value={role}>{role} ({roleCounts[role]})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredMembers.length} of {members.length} members
          </span>
          <div className="flex items-center border rounded-lg p-1 bg-secondary">
            <Button
              variant={viewMode === 'roles' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('roles')}
              title="Group by Role"
            >
              <LayoutGrid size={16} />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <Grid size={16} />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <List size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Role-wise Groups View */}
      {viewMode === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ROLES.map((role) => {
            const roleMembers = membersByRole[role];
            if (roleMembers.length === 0) return null;
            
            return (
              <div 
                key={role}
                className="bg-card rounded-xl border border-border/50 overflow-hidden"
              >
                <div className={`px-4 py-3 border-b border-border/50 ${ROLE_COLORS[role].replace('text-', 'bg-').split(' ')[0]}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={ROLE_COLORS[role]}>
                        {role}
                      </Badge>
                      <span className="font-semibold">{ROLE_LABELS[role]}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {roleMembers.length} members
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-3">
                    {roleMembers.map((member) => (
                      <div 
                        key={member.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={`text-xs ${ROLE_COLORS[role]}`}>
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.department}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Team Grid */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers.map((member, index) => {
            const reportingTL = member.reportingTLId 
              ? members.find(m => m.id === member.reportingTLId) 
              : undefined;
            return (
              <TeamMemberCard 
                key={member.id} 
                member={member}
                reportingTL={reportingTL}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` } as React.CSSProperties}
              />
            );
          })}
        </div>
      )}

      {/* Team List */}
      {viewMode === 'list' && (
        <div className="bg-card rounded-xl border border-border/50 divide-y divide-border">
          {filteredMembers.map((member) => {
            const reportingTL = member.reportingTLId 
              ? members.find(m => m.id === member.reportingTLId) 
              : undefined;
            return (
              <TeamMemberCard 
                key={member.id} 
                member={member} 
                reportingTL={reportingTL}
                compact 
                className="hover:bg-secondary/30"
              />
            );
          })}
        </div>
      )}

      {filteredMembers.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto text-muted-foreground opacity-50 mb-3" size={48} />
          <p className="text-muted-foreground">No team members found matching your filters</p>
        </div>
      )}
    </div>
  );
}
