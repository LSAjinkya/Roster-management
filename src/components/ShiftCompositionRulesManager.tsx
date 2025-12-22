import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { ShiftType, Department, DEPARTMENTS, Role, ROLES } from '@/types/roster';
import { ShiftCompositionRule, Datacenter } from '@/types/shiftRules';

const SHIFT_TYPES: ShiftType[] = ['morning', 'afternoon', 'night', 'general'];

export function ShiftCompositionRulesManager() {
  const [rules, setRules] = useState<ShiftCompositionRule[]>([]);
  const [datacenters, setDatacenters] = useState<Datacenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ShiftCompositionRule> | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, dcRes] = await Promise.all([
        supabase.from('shift_composition_rules').select('*').order('department'),
        supabase.from('datacenters').select('*').eq('is_active', true),
      ]);

      if (rulesRes.error) throw rulesRes.error;
      if (dcRes.error) throw dcRes.error;

      setRules(rulesRes.data.map(r => ({
        ...r,
        shift_type: r.shift_type as ShiftType,
        department: r.department as Department,
        role_filter: r.role_filter as Role[] | null,
      })));
      setDatacenters(dcRes.data);
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast.error('Failed to load shift composition rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;

    try {
      const ruleData = {
        shift_type: editingRule.shift_type,
        department: editingRule.department,
        datacenter_id: editingRule.datacenter_id || null,
        min_count: editingRule.min_count || 1,
        role_filter: editingRule.role_filter?.length ? editingRule.role_filter : null,
        is_active: editingRule.is_active ?? true,
      };

      if (editingRule.id) {
        const { error } = await supabase
          .from('shift_composition_rules')
          .update(ruleData)
          .eq('id', editingRule.id);
        if (error) throw error;
        toast.success('Rule updated');
      } else {
        const { error } = await supabase
          .from('shift_composition_rules')
          .insert(ruleData);
        if (error) throw error;
        toast.success('Rule created');
      }

      setEditDialogOpen(false);
      setEditingRule(null);
      fetchData();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Failed to save rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shift_composition_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Rule deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    }
  };

  const openEditDialog = (rule?: ShiftCompositionRule) => {
    setEditingRule(rule || {
      shift_type: 'morning',
      department: 'Support',
      min_count: 1,
      is_active: true,
    });
    setEditDialogOpen(true);
  };

  // Group rules by shift type for display
  const rulesByShift = SHIFT_TYPES.reduce((acc, shift) => {
    acc[shift] = rules.filter(r => r.shift_type === shift);
    return acc;
  }, {} as Record<ShiftType, ShiftCompositionRule[]>);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading rules...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Shift Composition Rules</CardTitle>
            <CardDescription>
              Define minimum staffing requirements per shift type and department
            </CardDescription>
          </div>
          <Button onClick={() => openEditDialog()} className="gap-2">
            <Plus size={16} />
            Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {SHIFT_TYPES.map(shiftType => (
          <div key={shiftType} className="space-y-2">
            <h4 className="font-medium capitalize flex items-center gap-2">
              <Badge variant={shiftType === 'night' ? 'secondary' : 'outline'}>
                {shiftType.toUpperCase()}
              </Badge>
              Shift Requirements
            </h4>
            {rulesByShift[shiftType].length === 0 ? (
              <p className="text-sm text-muted-foreground">No rules defined</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Datacenter</TableHead>
                    <TableHead>Min Staff</TableHead>
                    <TableHead>Role Filter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rulesByShift[shiftType].map(rule => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.department}</TableCell>
                      <TableCell>
                        {rule.datacenter_id 
                          ? datacenters.find(d => d.id === rule.datacenter_id)?.name || '-'
                          : 'All'
                        }
                      </TableCell>
                      <TableCell>{rule.min_count}</TableCell>
                      <TableCell>
                        {rule.role_filter?.join(', ') || 'Any'}
                      </TableCell>
                      <TableCell>
                        {rule.is_active ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle size={12} />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(rule)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ))}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRule?.id ? 'Edit Rule' : 'Add Rule'}
              </DialogTitle>
            </DialogHeader>
            
            {editingRule && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Shift Type</Label>
                    <Select
                      value={editingRule.shift_type as string}
                      onValueChange={(v) => setEditingRule({ ...editingRule, shift_type: v as ShiftType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIFT_TYPES.map(s => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select
                      value={editingRule.department as string}
                      onValueChange={(v) => setEditingRule({ ...editingRule, department: v as Department })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Datacenter (optional)</Label>
                    <Select
                      value={editingRule.datacenter_id || 'all'}
                      onValueChange={(v) => setEditingRule({ 
                        ...editingRule, 
                        datacenter_id: v === 'all' ? null : v 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Datacenters</SelectItem>
                        {datacenters.map(dc => (
                          <SelectItem key={dc.id} value={dc.id}>{dc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Minimum Staff Count</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editingRule.min_count || 1}
                      onChange={(e) => setEditingRule({ 
                        ...editingRule, 
                        min_count: parseInt(e.target.value) || 1 
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Role Filter (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map(role => (
                      <Button
                        key={role}
                        variant={editingRule.role_filter?.includes(role) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const current = editingRule.role_filter || [];
                          const updated = current.includes(role)
                            ? current.filter(r => r !== role)
                            : [...current, role];
                          setEditingRule({ ...editingRule, role_filter: updated });
                        }}
                      >
                        {role}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to include all roles
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch
                    checked={editingRule.is_active ?? true}
                    onCheckedChange={(checked) => setEditingRule({ 
                      ...editingRule, 
                      is_active: checked 
                    })}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRule}>
                Save Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
