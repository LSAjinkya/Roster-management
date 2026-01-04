import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, CheckCircle, Sun, Sunset, Moon, Clock, Save, Loader2, Info } from 'lucide-react';
import { Department, DEPARTMENTS, Role, ROLES } from '@/types/roster';
import { ShiftCompositionRule, Datacenter } from '@/types/shiftRules';

// Work shifts only (excluding leave types)
type WorkShiftType = 'morning' | 'afternoon' | 'night' | 'general';
const WORK_SHIFT_TYPES: WorkShiftType[] = ['morning', 'afternoon', 'night', 'general'];

const SHIFT_ICONS: Record<WorkShiftType, React.ReactNode> = {
  morning: <Sun size={14} className="text-blue-500" />,
  afternoon: <Sunset size={14} className="text-amber-500" />,
  night: <Moon size={14} className="text-purple-500" />,
  general: <Clock size={14} className="text-green-500" />,
};

export function ShiftCompositionRulesManager() {
  const [rules, setRules] = useState<ShiftCompositionRule[]>([]);
  const [datacenters, setDatacenters] = useState<Datacenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ShiftCompositionRule> | null>(null);
  const [viewMode, setViewMode] = useState<'shift-wise' | 'by-shift'>('shift-wise');

  // For shift-wise editing
  const [shiftWiseData, setShiftWiseData] = useState<Record<string, Record<WorkShiftType, number>>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Build shift-wise data from rules
    const data: Record<string, Record<WorkShiftType, number>> = {};
    
    DEPARTMENTS.forEach(dept => {
      data[dept] = { morning: 0, afternoon: 0, night: 0, general: 0 };
    });

    rules.filter(r => r.is_active && !r.datacenter_id && WORK_SHIFT_TYPES.includes(r.shift_type as WorkShiftType)).forEach(rule => {
      if (data[rule.department]) {
        data[rule.department][rule.shift_type as WorkShiftType] = rule.min_count;
      }
    });

    setShiftWiseData(data);
    setHasChanges(false);
  }, [rules]);

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
        shift_type: r.shift_type as WorkShiftType,
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

  const updateShiftWiseCount = (dept: string, shift: WorkShiftType, count: number) => {
    setShiftWiseData(prev => ({
      ...prev,
      [dept]: { ...prev[dept], [shift]: Math.max(0, count) },
    }));
    setHasChanges(true);
  };

  const saveShiftWiseChanges = async () => {
    setSaving(true);
    try {
      // Get all current rules without datacenter filter
      const existingRules = rules.filter(r => !r.datacenter_id);
      
      for (const dept of DEPARTMENTS) {
        for (const shift of WORK_SHIFT_TYPES) {
          const count = shiftWiseData[dept]?.[shift] || 0;
          const existingRule = existingRules.find(
            r => r.department === dept && r.shift_type === shift
          );

          if (count > 0) {
            if (existingRule) {
              // Update existing rule
              await supabase
                .from('shift_composition_rules')
                .update({ min_count: count, is_active: true })
                .eq('id', existingRule.id);
            } else {
              // Create new rule
              await supabase
                .from('shift_composition_rules')
                .insert({
                  department: dept,
                  shift_type: shift,
                  min_count: count,
                  is_active: true,
                });
            }
          } else if (existingRule) {
            // Deactivate rule if count is 0
            await supabase
              .from('shift_composition_rules')
              .update({ is_active: false })
              .eq('id', existingRule.id);
          }
        }
      }

      toast.success('Shift composition rules saved');
      setHasChanges(false);
      fetchData();
    } catch (error) {
      console.error('Error saving rules:', error);
      toast.error('Failed to save rules');
    } finally {
      setSaving(false);
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
  const rulesByShift = WORK_SHIFT_TYPES.reduce((acc, shift) => {
    acc[shift] = rules.filter(r => r.shift_type === shift);
    return acc;
  }, {} as Record<WorkShiftType, ShiftCompositionRule[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Shift Composition Rules</CardTitle>
              <CardDescription className="text-muted-foreground">
                Define minimum staffing requirements per shift type and department
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {viewMode === 'by-shift' && (
                <Button onClick={() => openEditDialog()} className="gap-2">
                  <Plus size={16} />
                  Add Rule
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'shift-wise' | 'by-shift')}>
            <TabsList className="mb-4">
              <TabsTrigger value="shift-wise" className="gap-2">
                <Clock size={14} />
                Shift-wise Staff Count
              </TabsTrigger>
              <TabsTrigger value="by-shift" className="gap-2">
                <Plus size={14} />
                Advanced Rules
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shift-wise" className="space-y-4">
              {/* Shift-wise view - shows all shifts as columns per department */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Department</TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {SHIFT_ICONS.morning}
                          <span>Morning</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {SHIFT_ICONS.afternoon}
                          <span>Afternoon</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {SHIFT_ICONS.night}
                          <span>Night</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {SHIFT_ICONS.general}
                          <span>General</span>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DEPARTMENTS.map(dept => (
                      <TableRow key={dept}>
                        <TableCell className="font-medium">
                          <Badge variant="outline">{dept}</Badge>
                        </TableCell>
                        {WORK_SHIFT_TYPES.map(shift => (
                          <TableCell key={shift} className="text-center">
                            <Input
                              type="number"
                              value={shiftWiseData[dept]?.[shift] || 0}
                              onChange={(e) => updateShiftWiseCount(dept, shift, parseInt(e.target.value) || 0)}
                              min={0}
                              max={50}
                              className="w-16 h-8 mx-auto text-center"
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  onClick={saveShiftWiseChanges} 
                  disabled={saving || !hasChanges}
                  className="gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {hasChanges ? 'Save Changes' : 'Saved'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="by-shift" className="space-y-6">
              {/* Original view - grouped by shift type */}
              {WORK_SHIFT_TYPES.map(shiftType => (
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
            </TabsContent>
          </Tabs>

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
                        onValueChange={(v) => setEditingRule({ ...editingRule, shift_type: v as WorkShiftType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_SHIFT_TYPES.map(s => (
                            <SelectItem key={s} value={s} className="capitalize">
                              <div className="flex items-center gap-2">
                                {SHIFT_ICONS[s]}
                                <span className="capitalize">{s}</span>
                              </div>
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

      {/* Info Card */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info size={20} className="text-blue-500 shrink-0" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-400">How Shift Composition Works</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Shift-wise view:</strong> Quickly set minimum staff per shift for each department</li>
                <li><strong>Advanced rules:</strong> Add datacenter-specific or role-filtered rules</li>
                <li>These rules are validated when generating rosters</li>
                <li>Warnings shown if minimum staffing cannot be met</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
