import { useState } from 'react';
import { TeamMember, Department, Role, DEPARTMENTS, ROLES } from '@/types/roster';
import { TeamMemberCard } from './TeamMemberCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Grid, List, LayoutGrid, Building2, ChevronDown, ChevronUp, Mail, Circle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface TeamOverviewProps {
  members: TeamMember[];
}

const ROLE_COLORS: Record<Role, string> = {
  'Admin': 'bg-destructive/20 text-destructive border-destructive/30',
  'Manager': 'bg-violet-500/20 text-violet-700 border-violet-500/30',
  'TL': 'bg-primary/20 text-primary border-primary/30',
  'L3': 'bg-indigo-500/20 text-indigo-700 border-indigo-500/30',
  'L2': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'L1': 'bg-green-500/20 text-green-700 border-green-500/30',
  'HR': 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  'Trainee': 'bg-amber-500/20 text-amber-700 border-amber-500/30',
};

const ROLE_LABELS: Record<Role, string> = {
  'Admin': 'Administrators',
  'Manager': 'Managers',
  'TL': 'Team Leads',
  'L3': 'Level 3',
  'L2': 'Level 2',
  'L1': 'Level 1',
  'HR': 'HR Team',
  'Trainee': 'Trainees',
};

const STATUS_COLORS: Record<string, string> = {
  'available': 'text-green-500',
  'on-leave': 'text-amber-500',
  'unavailable': 'text-red-500',
};

export function TeamOverview({ members }: TeamOverviewProps) {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'roles' | 'departments'>('roles');
  const [expandedRoles, setExpandedRoles] = useState<Set<Role>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<Department>>(new Set());

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

  // Group members by role
  const membersByRole = ROLES.reduce((acc, role) => {
    acc[role] = filteredMembers.filter(m => m.role === role);
    return acc;
  }, {} as Record<Role, TeamMember[]>);

  // Group members by department
  const membersByDepartment = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = filteredMembers.filter(m => m.department === dept);
    return acc;
  }, {} as Record<Department, TeamMember[]>);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const toggleRoleExpand = (role: Role) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(role)) {
      newExpanded.delete(role);
    } else {
      newExpanded.add(role);
    }
    setExpandedRoles(newExpanded);
  };

  const toggleDeptExpand = (dept: Department) => {
    const newExpanded = new Set(expandedDepts);
    if (newExpanded.has(dept)) {
      newExpanded.delete(dept);
    } else {
      newExpanded.add(dept);
    }
    setExpandedDepts(newExpanded);
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
              variant={viewMode === 'departments' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('departments')}
              title="Group by Department"
            >
              <Building2 size={16} />
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
            const isExpanded = expandedRoles.has(role);
            
            return (
              <Collapsible 
                key={role}
                open={isExpanded}
                onOpenChange={() => toggleRoleExpand(role)}
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
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {roleMembers.length} members
                      </Badge>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </div>
                
                {/* Compact View */}
                {!isExpanded && (
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {roleMembers.map((member) => (
                        <div 
                          key={member.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary transition-colors"
                        >
                          <Circle className={`h-2 w-2 fill-current ${STATUS_COLORS[member.status]}`} />
                          <span className="text-sm font-medium">{member.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expanded View */}
                <CollapsibleContent>
                  <div className="p-4 space-y-2">
                    {roleMembers.map((member) => (
                      <div 
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className={`text-sm ${ROLE_COLORS[role]}`}>
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail size={12} />
                              <span>{member.email}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            {member.department}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            <Circle className={`h-2 w-2 fill-current ${STATUS_COLORS[member.status]}`} />
                            <span className={`text-xs capitalize ${STATUS_COLORS[member.status]}`}>
                              {member.status.replace('-', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Department-wise Groups View */}
      {viewMode === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DEPARTMENTS.map((dept) => {
            const deptMembers = membersByDepartment[dept];
            if (deptMembers.length === 0) return null;
            const isExpanded = expandedDepts.has(dept);
            
            return (
              <Collapsible 
                key={dept}
                open={isExpanded}
                onOpenChange={() => toggleDeptExpand(dept)}
                className="bg-card rounded-xl border border-border/50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border/50 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{dept}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {deptMembers.length} members
                      </Badge>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </div>
                
                {/* Compact View */}
                {!isExpanded && (
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {deptMembers.map((member) => (
                        <div 
                          key={member.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary transition-colors"
                        >
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[member.role]}`}>
                            {member.role}
                          </Badge>
                          <span className="text-sm font-medium">{member.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expanded View */}
                <CollapsibleContent>
                  <div className="p-4 space-y-2">
                    {deptMembers.map((member) => (
                      <div 
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className={`text-sm ${ROLE_COLORS[member.role]}`}>
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail size={12} />
                              <span>{member.email}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                            {member.role}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            <Circle className={`h-2 w-2 fill-current ${STATUS_COLORS[member.status]}`} />
                            <span className={`text-xs capitalize ${STATUS_COLORS[member.status]}`}>
                              {member.status.replace('-', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
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
