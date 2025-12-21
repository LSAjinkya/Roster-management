import { useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DEPARTMENTS, ROLES, type Department, type Role } from '@/types/roster';
import { Building2, Users, UserCheck, Loader2, ChevronRight, Crown, Edit2, UserPlus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  reporting_tl_id: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  'TL': 'bg-primary/20 text-primary border-primary/30',
  'L2': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'L1': 'bg-green-500/20 text-green-700 border-green-500/30',
  'HR': 'bg-purple-500/20 text-purple-700 border-purple-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  'available': 'text-green-500',
  'on-leave': 'text-amber-500',
  'unavailable': 'text-red-500',
};

export default function Departments() {
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [assignDeptDialogOpen, setAssignDeptDialogOpen] = useState(false);
  const [selectedMemberForDept, setSelectedMemberForDept] = useState<TeamMember | null>(null);
  const queryClient = useQueryClient();

  const { data: teamMembers = [], isLoading, refetch } = useQuery({
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
    
    // Find department head (TL)
    const departmentHead = members.find(m => m.role === 'TL');
    
    return {
      name: dept,
      total: members.length,
      available: members.filter(m => m.status === 'available').length,
      onLeave: members.filter(m => m.status === 'on-leave').length,
      roleBreakdown,
      members,
      departmentHead,
    };
  }).filter(dept => dept.total > 0);

  // Get all members without department or for reassignment
  const allMembers = teamMembers;

  const selectedDeptData = departmentData.find(d => d.name === selectedDepartment);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Role updated successfully');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleDepartmentChange = async (memberId: string, newDepartment: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ department: newDepartment })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Department updated successfully');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setAssignDeptDialogOpen(false);
      setSelectedMemberForDept(null);
    } catch (error) {
      console.error('Error updating department:', error);
      toast.error('Failed to update department');
    }
  };

  const handleStatusChange = async (memberId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ status: newStatus })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Status updated successfully');
      refetch();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleSetDepartmentHead = async (memberId: string, departmentName: string) => {
    try {
      // First, update the selected member to TL role
      const { error } = await supabase
        .from('team_members')
        .update({ role: 'TL' })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Department head assigned successfully');
      refetch();
    } catch (error) {
      console.error('Error setting department head:', error);
      toast.error('Failed to assign department head');
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
                  
                  {/* Department Head */}
                  {dept.departmentHead && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <Crown size={14} className="text-amber-500" />
                      <span className="text-muted-foreground">Head:</span>
                      <span className="font-medium">{dept.departmentHead.name}</span>
                    </div>
                  )}
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
                      {ROLES.map(role => (
                        <div key={role} className="flex items-center justify-between">
                          <span className="text-sm">{role}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ 
                                  width: dept.total > 0 ? `${(dept.roleBreakdown[role] / dept.total) * 100}%` : '0%'
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedDepartment} Team
              <Badge variant="secondary" className="ml-2">
                {selectedDeptData?.total || 0} members
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          {/* Department Head Section */}
          {selectedDeptData && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  <span className="font-medium">Department Head</span>
                </div>
                {selectedDeptData.departmentHead ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {selectedDeptData.departmentHead.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{selectedDeptData.departmentHead.name}</span>
                  </div>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Assign Head
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Select Team Member</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {selectedDeptData.members.filter(m => m.role !== 'TL').map(member => (
                        <DropdownMenuItem 
                          key={member.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDepartmentHead(member.id, selectedDepartment!);
                          }}
                        >
                          {member.name}
                        </DropdownMenuItem>
                      ))}
                      {selectedDeptData.members.filter(m => m.role !== 'TL').length === 0 && (
                        <DropdownMenuItem disabled>No available members</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          )}
          
          <ScrollArea className="max-h-[50vh]">
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{member.name}</p>
                        {member.role === 'TL' && (
                          <Crown className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Role Select */}
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleRoleChange(member.id, value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            <Badge variant="outline" className={ROLE_COLORS[role] || ''}>
                              {role}
                            </Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Status Select */}
                    <Select
                      value={member.status}
                      onValueChange={(value) => handleStatusChange(member.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['available', 'on-leave', 'unavailable']).map((status) => (
                          <SelectItem key={status} value={status}>
                            <span className={`capitalize ${STATUS_COLORS[status]}`}>
                              {status.replace('-', ' ')}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Change Department */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Move to Department</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {DEPARTMENTS.filter(d => d !== member.department).map(dept => (
                          <DropdownMenuItem 
                            key={dept}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDepartmentChange(member.id, dept);
                            }}
                          >
                            {dept}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
