import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Users, Crown, User, Building2, Briefcase } from 'lucide-react';
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

// Directors - Top leadership
const DIRECTORS = [
  { name: 'Ishan Talathi', title: 'Director' },
  { name: 'Karan Jaju', title: 'Director' },
  { name: 'Priyen Sangoi', title: 'Director' },
  { name: 'Shekhar Talathi', title: 'Director' },
];

// Department Managers
const MANAGERS = [
  { name: 'Ishan Talathi', title: 'Support Manager', department: 'Support' },
  { name: 'Karan Jaju', title: 'Sales Manager', department: 'Sales' },
  { name: 'Priyen Sangoi', title: 'Billing Manager', department: 'Billing' },
];

// Admin/HR team
const ADMIN_TEAM = ['Ajinkya Lawand'];

// Team Leads
const TEAM_LEADS = [
  'Ajinkya Lawand',
  'Amol Mahajan',
  'Deepak Singh',
  'Omkar Dounde',
  'Rakesh Chauhan',
  'Salman Khan',
  'Suresh Thaware',
  'Swapnil Aher',
];

export function OrgChart({ members, onMemberClick }: OrgChartProps) {
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['directors', 'managers', 'tls']));

  // Get all TLs from members that match our TL list
  const teamLeads = members.filter(m => 
    TEAM_LEADS.some(tl => m.name.toLowerCase().includes(tl.toLowerCase().split(' ')[0]))
  );
  
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

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const findMemberByName = (name: string) => {
    return members.find(m => m.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]));
  };

  return (
    <div className="space-y-6">
      {/* Directors Section */}
      <Card className="border-2 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
        <div
          className="p-4 cursor-pointer flex items-center justify-between"
          onClick={() => toggleSection('directors')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Crown className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Board of Directors</h3>
              <p className="text-sm text-muted-foreground">{DIRECTORS.length} Directors</p>
            </div>
          </div>
          {expandedSections.has('directors') ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        
        {expandedSections.has('directors') && (
          <CardContent className="pt-0 pb-4">
            <div className="flex flex-wrap justify-center gap-4">
              {DIRECTORS.map((director) => {
                const member = findMemberByName(director.name);
                return (
                  <Card 
                    key={director.name}
                    className="w-52 cursor-pointer hover:shadow-lg transition-shadow border-amber-300/50 bg-white dark:bg-card"
                    onClick={() => member && onMemberClick?.(member)}
                  >
                    <CardContent className="p-4 text-center">
                      <Avatar className="h-14 w-14 mx-auto mb-3 border-2 border-amber-500">
                        <AvatarFallback className="bg-amber-100 text-amber-700 text-lg">
                          {getInitials(director.name)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-semibold">{director.name}</p>
                      <Badge className="mt-2 bg-amber-500/20 text-amber-700 border-amber-500/30">
                        {director.title}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Connecting line */}
      <div className="flex justify-center">
        <div className="w-0.5 h-8 bg-border" />
      </div>

      {/* Managers Section */}
      <Card className="border-2 border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
        <div
          className="p-4 cursor-pointer flex items-center justify-between"
          onClick={() => toggleSection('managers')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Department Managers</h3>
              <p className="text-sm text-muted-foreground">{MANAGERS.length} Managers</p>
            </div>
          </div>
          {expandedSections.has('managers') ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        
        {expandedSections.has('managers') && (
          <CardContent className="pt-0 pb-4">
            <div className="flex flex-wrap justify-center gap-4">
              {MANAGERS.map((manager) => {
                const member = findMemberByName(manager.name);
                const deptColor = DEPARTMENT_COLORS[manager.department] || 'bg-gray-500/20 text-gray-700';
                return (
                  <Card 
                    key={`${manager.name}-${manager.department}`}
                    className="w-52 cursor-pointer hover:shadow-lg transition-shadow border-blue-300/50 bg-white dark:bg-card"
                    onClick={() => member && onMemberClick?.(member)}
                  >
                    <CardContent className="p-4 text-center">
                      <Avatar className="h-14 w-14 mx-auto mb-3 border-2 border-blue-500">
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-lg">
                          {getInitials(manager.name)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-semibold">{manager.name}</p>
                      <Badge className="mt-2 bg-blue-500/20 text-blue-700 border-blue-500/30">
                        {manager.title}
                      </Badge>
                      <Badge variant="outline" className={cn("mt-2 text-xs", deptColor)}>
                        {manager.department}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Connecting line */}
      <div className="flex justify-center">
        <div className="w-0.5 h-8 bg-border" />
      </div>

      {/* Admin & Team Leads Section */}
      <Card className="border-2 border-primary/30 bg-primary/5">
        <div
          className="p-4 cursor-pointer flex items-center justify-between"
          onClick={() => toggleSection('tls')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Admin & Team Leads</h3>
              <p className="text-sm text-muted-foreground">{TEAM_LEADS.length} Team Leads</p>
            </div>
          </div>
          {expandedSections.has('tls') ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        
        {expandedSections.has('tls') && (
          <CardContent className="pt-0 pb-4">
            <div className="flex flex-wrap justify-center gap-3">
              {TEAM_LEADS.map((tlName) => {
                const member = findMemberByName(tlName);
                const isAdmin = ADMIN_TEAM.includes(tlName);
                return (
                  <Card 
                    key={tlName}
                    className={cn(
                      "w-44 cursor-pointer hover:shadow-md transition-shadow",
                      isAdmin ? "border-destructive/30 bg-destructive/5" : "border-secondary/50"
                    )}
                    onClick={() => member && onMemberClick?.(member)}
                  >
                    <CardContent className="p-3 text-center">
                      <Avatar className={cn(
                        "h-12 w-12 mx-auto mb-2",
                        isAdmin ? "border-2 border-destructive" : ""
                      )}>
                        <AvatarFallback className={cn(
                          isAdmin 
                            ? "bg-destructive/20 text-destructive" 
                            : "bg-secondary text-secondary-foreground"
                        )}>
                          {getInitials(tlName)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-medium text-sm">{tlName}</p>
                      {isAdmin ? (
                        <Badge className="mt-1 text-xs bg-destructive/20 text-destructive border-destructive/30">
                          Admin + TL
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="mt-1 text-xs">Team Lead</Badge>
                      )}
                      {member?.department && (
                        <p className="text-xs text-muted-foreground mt-1">{member.department}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Connecting line */}
      <div className="flex justify-center">
        <div className="w-0.5 h-8 bg-border" />
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Object.entries(membersByDept)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dept, deptMembers]) => {
            // Filter out directors, managers, and TLs from the regular member list
            const regularMembers = deptMembers.filter(m => {
              const isDirector = DIRECTORS.some(d => m.name.toLowerCase().includes(d.name.toLowerCase().split(' ')[0]));
              const isManager = MANAGERS.some(mg => m.name.toLowerCase().includes(mg.name.toLowerCase().split(' ')[0]));
              const isTL = TEAM_LEADS.some(tl => m.name.toLowerCase().includes(tl.toLowerCase().split(' ')[0]));
              return !isDirector && !isManager && !isTL;
            });
            
            if (regularMembers.length === 0) return null;
            
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
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">{dept}</span>
                    <Badge variant="outline" className="text-xs">
                      {regularMembers.length}
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
                      {regularMembers.map(member => (
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