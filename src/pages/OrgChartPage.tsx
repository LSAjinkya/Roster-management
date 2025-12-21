import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Network, Users, Building2 } from 'lucide-react';
import { OrgChart } from '@/components/OrgChart';
import { ReportingHierarchy } from '@/components/ReportingHierarchy';
import { DEPARTMENTS } from '@/types/roster';

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

  const teamLeads = members.filter(m => m.role === 'TL');
  const filteredMembers = selectedDept === 'all' 
    ? members 
    : members.filter(m => m.department === selectedDept);

  // Stats
  const totalMembers = members.filter(m => m.role !== 'TL').length;
  const assignedMembers = members.filter(m => m.role !== 'TL' && m.reporting_tl_id).length;
  const unassignedMembers = totalMembers - assignedMembers;

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

      {/* Bulk Department Reassign */}
      {canManage && (
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
      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chart" className="gap-2">
            <Network className="h-4 w-4" />
            Org Chart
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="gap-2">
            <Users className="h-4 w-4" />
            Reporting Hierarchy
          </TabsTrigger>
        </TabsList>

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
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
