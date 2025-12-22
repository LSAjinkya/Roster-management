import { useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { ROLES } from '@/types/roster';
import { Building2, Users, UserCheck, Loader2, ChevronRight, Crown, Edit2, UserPlus, Plus, Trash2, Save, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  reporting_tl_id: string | null;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  head_member_id: string | null;
  is_active: boolean;
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
  const [addDeptDialogOpen, setAddDeptDialogOpen] = useState(false);
  const [deleteDeptDialogOpen, setDeleteDeptDialogOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [newDept, setNewDept] = useState({ name: '', description: '' });
  const [editDeptDialogOpen, setEditDeptDialogOpen] = useState(false);
  const [deptToEdit, setDeptToEdit] = useState<Department | null>(null);
  const [editedDept, setEditedDept] = useState({ name: '', description: '' });
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  // Fetch departments from database
  const { data: departments = [], isLoading: deptsLoading, refetch: refetchDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Department[];
    },
  });

  const { data: teamMembers = [], isLoading: membersLoading, refetch: refetchMembers } = useQuery({
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

  const isLoading = deptsLoading || membersLoading;

  const departmentData = departments.map(dept => {
    const members = teamMembers.filter(m => m.department === dept.name);
    const roleBreakdown = ROLES.reduce((acc, role) => {
      acc[role] = members.filter(m => m.role === role).length;
      return acc;
    }, {} as Record<string, number>);
    
    const departmentHead = members.find(m => m.role === 'TL');
    
    return {
      ...dept,
      total: members.length,
      available: members.filter(m => m.status === 'available').length,
      onLeave: members.filter(m => m.status === 'on-leave').length,
      roleBreakdown,
      members,
      departmentHead,
    };
  });

  const selectedDeptData = departmentData.find(d => d.name === selectedDepartment);

  const handleAddDepartment = async () => {
    if (!newDept.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('departments')
        .insert({
          name: newDept.name.trim(),
          description: newDept.description.trim() || null,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Department already exists');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Department created successfully');
      setAddDeptDialogOpen(false);
      setNewDept({ name: '', description: '' });
      refetchDepts();
    } catch (error) {
      console.error('Error creating department:', error);
      toast.error('Failed to create department');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!deptToDelete) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('departments')
        .update({ is_active: false })
        .eq('id', deptToDelete.id);

      if (error) throw error;

      toast.success('Department deleted successfully');
      setDeleteDeptDialogOpen(false);
      setDeptToDelete(null);
      refetchDepts();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast.error('Failed to delete department');
    } finally {
      setSaving(false);
    }
  };

  const handleEditDepartment = (dept: Department) => {
    setDeptToEdit(dept);
    setEditedDept({ name: dept.name, description: dept.description || '' });
    setEditDeptDialogOpen(true);
  };

  const handleSaveDepartment = async () => {
    if (!deptToEdit) return;

    if (!editedDept.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    setSaving(true);
    try {
      const oldName = deptToEdit.name;
      const newName = editedDept.name.trim();

      const { error } = await supabase
        .from('departments')
        .update({
          name: newName,
          description: editedDept.description.trim() || null,
        })
        .eq('id', deptToEdit.id);

      if (error) {
        if (error.code === '23505') {
          toast.error('A department with this name already exists');
        } else {
          throw error;
        }
        return;
      }

      // Update team members if department name changed
      if (oldName !== newName) {
        const { error: membersError } = await supabase
          .from('team_members')
          .update({ department: newName })
          .eq('department', oldName);

        if (membersError) {
          console.error('Error updating team members department:', membersError);
        }
      }

      toast.success('Department updated successfully');
      setEditDeptDialogOpen(false);
      setDeptToEdit(null);
      refetchDepts();
      refetchMembers();
    } catch (error) {
      console.error('Error updating department:', error);
      toast.error('Failed to update department');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUserToDepartment = async (memberId: string) => {
    if (!selectedDepartment) return;
    
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ department: selectedDepartment })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('User added to department');
      setAddUserDialogOpen(false);
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    } catch (error) {
      console.error('Error adding user to department:', error);
      toast.error('Failed to add user to department');
    }
  };

  const availableUsersForDepartment = teamMembers.filter(
    m => m.department !== selectedDepartment
  );

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Role updated successfully');
      refetchMembers();
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
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
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
      refetchMembers();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleSetDepartmentHead = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: 'TL' })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Department head assigned successfully');
      refetchMembers();
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
        {/* Add Department Button */}
        <div className="flex justify-end">
          <Button onClick={() => setAddDeptDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Department
          </Button>
        </div>

        {departmentData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No departments found</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setAddDeptDialogOpen(true)}
            >
              Create your first department
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departmentData.map((dept, index) => (
              <div 
                key={dept.id}
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
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDepartment(dept);
                        }}
                      >
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeptToDelete(dept);
                          setDeleteDeptDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                  
                  {dept.description && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{dept.description}</p>
                  )}
                  
                  {dept.departmentHead && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <Crown size={14} className="text-amber-500" />
                      <span className="text-muted-foreground">Head:</span>
                      <span className="font-medium">{dept.departmentHead.name}</span>
                    </div>
                  )}
                </div>
                
                <div className="p-5 space-y-4">
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
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {selectedDepartment} Team
                <Badge variant="secondary" className="ml-2">
                  {selectedDeptData?.total || 0} members
                </Badge>
              </DialogTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setAddUserDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </DialogHeader>
          
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
                            handleSetDepartmentHead(member.id);
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
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Move to Department</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {departments.filter(d => d.name !== member.department).map(dept => (
                          <DropdownMenuItem 
                            key={dept.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDepartmentChange(member.id, dept.name);
                            }}
                          >
                            {dept.name}
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

      {/* Add Department Dialog */}
      <Dialog open={addDeptDialogOpen} onOpenChange={setAddDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name">Department Name *</Label>
              <Input
                id="dept-name"
                placeholder="e.g., Engineering"
                value={newDept.name}
                onChange={(e) => setNewDept(prev => ({ ...prev, name: e.target.value }))}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-desc">Description</Label>
              <Textarea
                id="dept-desc"
                placeholder="Optional description..."
                value={newDept.description}
                onChange={(e) => setNewDept(prev => ({ ...prev, description: e.target.value }))}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDeptDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDepartment} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User to Department Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add User to {selectedDepartment}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 pr-4">
              {availableUsersForDepartment.length > 0 ? (
                availableUsersForDepartment.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.department}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddUserToDepartment(member.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  All users are already in this department
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={editDeptDialogOpen} onOpenChange={setEditDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Edit Department
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-dept-name">Department Name *</Label>
              <Input
                id="edit-dept-name"
                placeholder="e.g., Engineering"
                value={editedDept.name}
                onChange={(e) => setEditedDept(prev => ({ ...prev, name: e.target.value }))}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dept-desc">Description</Label>
              <Textarea
                id="edit-dept-desc"
                placeholder="Optional description..."
                value={editedDept.description}
                onChange={(e) => setEditedDept(prev => ({ ...prev, description: e.target.value }))}
                maxLength={200}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDeptDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDepartment} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Department Confirmation */}
      <AlertDialog open={deleteDeptDialogOpen} onOpenChange={setDeleteDeptDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deptToDelete?.name}"? This action cannot be undone.
              Team members in this department will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDepartment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
