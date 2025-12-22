import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Network, Users, Building2, Plus, Trash2, UserMinus, Settings, GitBranch } from 'lucide-react';
import { OrgChart } from '@/components/OrgChart';
import { ReportingHierarchy } from '@/components/ReportingHierarchy';
import { OrgTreeView } from '@/components/OrgTreeView';
import { DEPARTMENTS, ROLES } from '@/types/roster';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  reporting_tl_id: string | null;
}

export default function OrgChartPage() {
  const { isAdmin, isHR, isTL, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [bulkDeptTL, setBulkDeptTL] = useState<string>('');
  const [reassigningDept, setReassigningDept] = useState(false);
  
  // Department management state
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [addingDept, setAddingDept] = useState(false);
  
  // Bulk role removal state
  const [removeDeptRole, setRemoveDeptRole] = useState<string>('');
  const [removeRoleType, setRemoveRoleType] = useState<string>('');
  const [removingRoles, setRemovingRoles] = useState(false);

  const canManage = isAdmin || isHR;

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email, role, department, reporting_tl_id')
        .order('name');

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDeptReassign = async () => {
    if (!selectedDept || selectedDept === 'all' || !bulkDeptTL) {
      toast.error('Select a department and Team Lead');
      return;
    }

    setReassigningDept(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ reporting_tl_id: bulkDeptTL === 'none' ? null : bulkDeptTL })
        .eq('department', selectedDept)
        .neq('role', 'TL');

      if (error) throw error;

      const count = members.filter(m => m.department === selectedDept && m.role !== 'TL').length;
      toast.success(`${count} member(s) in ${selectedDept} reassigned`);
      setBulkDeptTL('');
      fetchMembers();
    } catch (error) {
      console.error('Bulk dept reassign error:', error);
      toast.error('Failed to reassign department');
    } finally {
      setReassigningDept(false);
    }
  };

  // Get unique departments from members (including ones not in DEPARTMENTS constant)
  const allDepartments = [...new Set([...DEPARTMENTS, ...members.map(m => m.department)])].sort();

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) {
      toast.error('Enter a department name');
      return;
    }

    if (allDepartments.includes(newDeptName.trim())) {
      toast.error('Department already exists');
      return;
    }

    setAddingDept(true);
    try {
      // For now, we just inform the user - in a real app you'd add to a departments table
      // Since departments are hardcoded in types, we'll just show success
      toast.success(`Department "${newDeptName}" noted. To fully add it, update the DEPARTMENTS constant in types/roster.ts`);
      setNewDeptName('');
      setAddDeptOpen(false);
    } catch (error) {
      console.error('Add department error:', error);
      toast.error('Failed to add department');
    } finally {
      setAddingDept(false);
    }
  };

  const handleBulkRoleRemoval = async () => {
    if (!removeDeptRole || !removeRoleType) {
      toast.error('Select a department and role type');
      return;
    }

    const affectedMembers = members.filter(
      m => m.department === removeDeptRole && m.role === removeRoleType
    );

    if (affectedMembers.length === 0) {
      toast.error(`No members with role "${removeRoleType}" in ${removeDeptRole}`);
      return;
    }

    setRemovingRoles(true);
    try {
      // Delete members with the specified role in the department
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('department', removeDeptRole)
        .eq('role', removeRoleType);

      if (error) throw error;

      toast.success(`Removed ${affectedMembers.length} member(s) with role "${removeRoleType}" from ${removeDeptRole}`);
      setRemoveDeptRole('');
      setRemoveRoleType('');
      fetchMembers();
    } catch (error) {
      console.error('Bulk role removal error:', error);
      toast.error('Failed to remove roles');
    } finally {
      setRemovingRoles(false);
    }
  };

  const teamLeads = members.filter(m => m.role === 'TL');
  const filteredMembers = selectedDept === 'all' 
    ? members 
    : members.filter(m => m.department === selectedDept);

  // Stats
  const totalMembers = members.filter(m => m.role !== 'TL').length;
  const assignedMembers = members.filter(m => m.role !== 'TL' && m.reporting_tl_id).length;
  const unassignedMembers = totalMembers - assignedMembers;

  // Get role counts for selected department
  const getRoleCountInDept = (dept: string, role: string) => {
    return members.filter(m => m.department === dept && m.role === role).length;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Network className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Organization Chart</h1>
            <p className="text-muted-foreground">View team structure and reporting hierarchy</p>
          </div>
        </div>
        
        {/* Admin Actions */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Dialog open={addDeptOpen} onOpenChange={setAddDeptOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Department</DialogTitle>
                  <DialogDescription>
                    Create a new department for the organization
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="dept-name">Department Name</Label>
                    <Input
                      id="dept-name"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      placeholder="e.g., Engineering"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Current departments: {allDepartments.length}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDeptOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddDepartment} disabled={addingDept}>
                    {addingDept ? 'Adding...' : 'Add Department'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{teamLeads.length}</p>
                <p className="text-xs text-muted-foreground">Team Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600">
              <div>
                <p className="text-2xl font-bold">{assignedMembers}</p>
                <p className="text-xs text-muted-foreground">Assigned to TL</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-600">
              <div>
                <p className="text-2xl font-bold">{unassignedMembers}</p>
                <p className="text-xs text-muted-foreground">Unassigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Management Cards */}
      {isAdmin && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Bulk Department Reassign */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Bulk TL Reassignment
              </CardTitle>
              <CardDescription>Reassign all members of a department to a Team Lead</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-3">
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {allDepartments.map(dept => (
                      <SelectItem key={dept} value={dept}>
                        {dept} ({members.filter(m => m.department === dept && m.role !== 'TL').length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedDept !== 'all' && (
                  <div className="flex items-center gap-2">
                    <Select value={bulkDeptTL} onValueChange={setBulkDeptTL}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Team Lead" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {teamLeads.map(tl => (
                          <SelectItem key={tl.id} value={tl.id}>
                            {tl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleBulkDeptReassign}
                      disabled={!bulkDeptTL || reassigningDept}
                      size="sm"
                    >
                      {reassigningDept ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reassign'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bulk Role Removal */}
          <Card className="border-destructive/30">
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <UserMinus className="h-4 w-4" />
                Remove Roles by Department
              </CardTitle>
              <CardDescription>Remove all members with a specific role from a department</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-3">
                <Select value={removeDeptRole} onValueChange={setRemoveDeptRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {allDepartments.map(dept => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {removeDeptRole && (
                  <div className="flex items-center gap-2">
                    <Select value={removeRoleType} onValueChange={setRemoveRoleType}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(role => (
                          <SelectItem key={role} value={role}>
                            {role} ({getRoleCountInDept(removeDeptRole, role)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive"
                          size="sm"
                          disabled={!removeRoleType || removingRoles}
                        >
                          {removingRoles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Members?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove {getRoleCountInDept(removeDeptRole, removeRoleType)} member(s) with role "{removeRoleType}" from {removeDeptRole}. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleBulkRoleRemoval}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove Members
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Non-admin bulk reassign */}
      {canManage && !isAdmin && (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Bulk Department Reassignment</CardTitle>
            <CardDescription>Reassign all members of a department to a different Team Lead</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {DEPARTMENTS.map(dept => (
                    <SelectItem key={dept} value={dept}>
                      {dept} ({members.filter(m => m.department === dept && m.role !== 'TL').length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedDept !== 'all' && (
                <>
                  <span className="text-muted-foreground">→</span>
                  <Select value={bulkDeptTL} onValueChange={setBulkDeptTL}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select Team Lead" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {teamLeads.map(tl => (
                        <SelectItem key={tl.id} value={tl.id}>
                          {tl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleBulkDeptReassign}
                    disabled={!bulkDeptTL || reassigningDept}
                  >
                    {reassigningDept ? 'Reassigning...' : 'Reassign Department'}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for different views */}
      <Tabs defaultValue="tree" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tree" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Tree View
          </TabsTrigger>
          <TabsTrigger value="chart" className="gap-2">
            <Network className="h-4 w-4" />
            Org Chart
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="gap-2">
            <Users className="h-4 w-4" />
            Reporting Hierarchy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tree">
          <OrgTreeView 
            members={filteredMembers} 
            onMemberClick={(member) => toast.info(`${member.name} - ${member.email}`)}
            onMemberUpdate={fetchMembers}
          />
        </TabsContent>

        <TabsContent value="chart">
          <OrgChart 
            members={filteredMembers} 
            onMemberClick={(member) => toast.info(`${member.name} - ${member.department}`)}
          />
        </TabsContent>

        <TabsContent value="hierarchy">
          <ReportingHierarchy 
            members={filteredMembers}
            onUpdate={fetchMembers}
            canManage={canManage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
