import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Users, Crown, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  reporting_tl_id: string | null;
}

interface OrgChartProps {
  members: TeamMember[];
  onMemberClick?: (member: TeamMember) => void;
}

const DEPARTMENT_COLORS: Record<string, string> = {
  'Support': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'Monitoring': 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  'CloudPe': 'bg-cyan-500/20 text-cyan-700 border-cyan-500/30',
  'Network': 'bg-green-500/20 text-green-700 border-green-500/30',
  'AW': 'bg-orange-500/20 text-orange-700 border-orange-500/30',
  'Infra': 'bg-red-500/20 text-red-700 border-red-500/30',
  'Vendor Coordinator': 'bg-pink-500/20 text-pink-700 border-pink-500/30',
  'HR': 'bg-indigo-500/20 text-indigo-700 border-indigo-500/30',
  'Sales': 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  'Admin': 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  'Marketing': 'bg-rose-500/20 text-rose-700 border-rose-500/30',
  'Billing': 'bg-teal-500/20 text-teal-700 border-teal-500/30',
  'CO': 'bg-violet-500/20 text-violet-700 border-violet-500/30',
  'Development': 'bg-sky-500/20 text-sky-700 border-sky-500/30',
};

export function OrgChart({ members, onMemberClick }: OrgChartProps) {
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Get all TLs
  const teamLeads = members.filter(m => m.role === 'TL');
  
  // Get the super TL (Ajinkya Lawand)
  const superTL = members.find(m => m.id === 'ajinkya-lawand');
  
  // Group members by department
  const membersByDept = members.reduce((acc, member) => {
    if (!acc[member.department]) {
      acc[member.department] = [];
    }
    acc[member.department].push(member);
    return acc;
  }, {} as Record<string, TeamMember[]>);

  const toggleDept = (dept: string) => {
    const newExpanded = new Set(expandedDepts);
    if (newExpanded.has(dept)) {
      newExpanded.delete(dept);
    } else {
      newExpanded.add(dept);
    }
    setExpandedDepts(newExpanded);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Super TL Card */}
      {superTL && (
        <div className="flex justify-center">
          <Card 
            className="w-64 cursor-pointer hover:shadow-lg transition-shadow border-2 border-primary/50 bg-primary/5"
            onClick={() => onMemberClick?.(superTL)}
          >
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-3">
                <Avatar className="h-16 w-16 border-2 border-primary">
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {getInitials(superTL.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Crown className="h-4 w-4 text-amber-500" />
                <span className="font-semibold">{superTL.name}</span>
              </div>
              <Badge className="bg-primary/20 text-primary border-primary/30">Super Admin</Badge>
              <p className="text-xs text-muted-foreground mt-2">{superTL.email}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Connecting line */}
      <div className="flex justify-center">
        <div className="w-0.5 h-8 bg-border" />
      </div>

      {/* Other TLs */}
      <div className="flex flex-wrap justify-center gap-4">
        {teamLeads.filter(tl => tl.id !== 'ajinkya-lawand').map(tl => (
          <Card 
            key={tl.id}
            className="w-48 cursor-pointer hover:shadow-md transition-shadow border-secondary/50"
            onClick={() => onMemberClick?.(tl)}
          >
            <CardContent className="p-3 text-center">
              <Avatar className="h-12 w-12 mx-auto mb-2">
                <AvatarFallback className="bg-secondary text-secondary-foreground">
                  {getInitials(tl.name)}
                </AvatarFallback>
              </Avatar>
              <p className="font-medium text-sm">{tl.name}</p>
              <Badge variant="secondary" className="text-xs">Team Lead</Badge>
              <p className="text-xs text-muted-foreground mt-1">{tl.department}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Connecting line */}
      <div className="flex justify-center">
        <div className="w-0.5 h-8 bg-border" />
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Object.entries(membersByDept)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dept, deptMembers]) => {
            const nonTLMembers = deptMembers.filter(m => m.role !== 'TL');
            const isExpanded = expandedDepts.has(dept);
            const deptColor = DEPARTMENT_COLORS[dept] || 'bg-gray-500/20 text-gray-700 border-gray-500/30';

            return (
              <Card key={dept} className="overflow-hidden">
                <div
                  className={cn(
                    "p-3 cursor-pointer flex items-center justify-between transition-colors",
                    deptColor
                  )}
                  onClick={() => toggleDept(dept)}
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">{dept}</span>
                    <Badge variant="outline" className="text-xs">
                      {nonTLMembers.length}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
                
                {isExpanded && (
                  <CardContent className="p-2 max-h-64 overflow-y-auto">
                    <div className="space-y-1">
                      {nonTLMembers.map(member => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                          onClick={() => onMemberClick?.(member)}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
}
