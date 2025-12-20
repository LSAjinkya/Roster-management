import { useState } from 'react';
import { TeamMember, Department, Role, DEPARTMENTS, ROLES } from '@/types/roster';
import { TeamMemberCard } from './TeamMemberCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, Users, Grid, List } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TeamOverviewProps {
  members: TeamMember[];
}

export function TeamOverview({ members }: TeamOverviewProps) {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
            <SelectContent>
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
            <SelectContent>
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
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('grid')}
            >
              <Grid size={16} />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('list')}
            >
              <List size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Team Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers.map((member, index) => (
            <TeamMemberCard 
              key={member.id} 
              member={member}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 30}ms` } as React.CSSProperties}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border/50 divide-y divide-border">
          {filteredMembers.map((member) => (
            <TeamMemberCard 
              key={member.id} 
              member={member} 
              compact 
              className="hover:bg-secondary/30"
            />
          ))}
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
