import { useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DEPARTMENTS, ROLES, type Department, type Role } from '@/types/roster';
import { Building2, Users, Shield, UserCheck, Loader2, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
}

export default function Departments() {
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['team-members-departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  const departmentData = DEPARTMENTS.map(dept => {
    const members = teamMembers.filter(m => m.department === dept);
    const roleBreakdown = ROLES.reduce((acc, role) => {
      acc[role] = members.filter(m => m.role === role).length;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      name: dept,
      total: members.length,
      available: members.filter(m => m.status === 'available').length,
      onLeave: members.filter(m => m.status === 'on-leave').length,
      roleBreakdown,
      members,
    };
  }).filter(dept => dept.total > 0); // Only show departments with members

  const selectedDeptData = departmentData.find(d => d.name === selectedDepartment);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'TL': return 'default';
      case 'L2': return 'secondary';
      case 'L1': return 'outline';
      case 'HR': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-500';
      case 'on-leave': return 'text-amber-500';
      case 'unavailable': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader 
          title="Departments" 
          subtitle="Department overview and team distribution" 
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Departments" 
        subtitle="Department overview and team distribution" 
      />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {departmentData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No team members found in any department</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departmentData.map((dept, index) => (
              <div 
                key={dept.name}
                className="bg-card rounded-xl border border-border/50 overflow-hidden animate-fade-in hover:shadow-soft transition-all cursor-pointer group"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => setSelectedDepartment(dept.name)}
              >
                <div className="p-5 border-b border-border/50 bg-secondary/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <Building2 size={22} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{dept.name}</h3>
                        <p className="text-sm text-muted-foreground">{dept.total} members</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
                
                <div className="p-5 space-y-4">
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck size={16} className="text-green-500" />
                      <span className="text-sm">Available</span>
                    </div>
                    <span className="font-medium">{dept.available}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-amber-500" />
                      <span className="text-sm">On Leave</span>
                    </div>
                    <span className="font-medium">{dept.onLeave}</span>
                  </div>
                  
                  {/* Role breakdown */}
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Role Distribution</p>
                    <div className="space-y-2">
                      {ROLES.filter(role => dept.roleBreakdown[role] > 0).map(role => (
                        <div key={role} className="flex items-center justify-between">
                          <span className="text-sm">{role}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ 
                                  width: `${(dept.roleBreakdown[role] / dept.total) * 100}%` 
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium w-4 text-right">
                              {dept.roleBreakdown[role]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Members Dialog */}
      <Dialog open={!!selectedDepartment} onOpenChange={(open) => !open && setSelectedDepartment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedDepartment} Team
              <Badge variant="secondary" className="ml-2">
                {selectedDeptData?.total || 0} members
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              {selectedDeptData?.members.map((member) => (
                <div 
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {member.role}
                    </Badge>
                    <div className={`flex items-center gap-1.5 text-sm ${getStatusColor(member.status)}`}>
                      <span className="h-2 w-2 rounded-full bg-current" />
                      <span className="capitalize">{member.status.replace('-', ' ')}</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {selectedDeptData?.members.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No team members in this department
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
