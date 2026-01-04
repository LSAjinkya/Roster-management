import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, Building2, Info, RefreshCw } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  work_days_per_cycle: number;
  off_days_per_cycle: number;
  rotation_enabled: boolean;
  is_active: boolean;
}

export function DepartmentRosterSettings() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (dept: Department) => {
    setSaving(dept.id);
    try {
      const { error } = await supabase
        .from('departments')
        .update({
          work_days_per_cycle: dept.work_days_per_cycle,
          off_days_per_cycle: dept.off_days_per_cycle,
          rotation_enabled: dept.rotation_enabled,
        })
        .eq('id', dept.id);

      if (error) throw error;
      toast.success(`${dept.name} settings saved`);
    } catch (error) {
      console.error('Error updating department:', error);
      toast.error('Failed to update department settings');
    } finally {
      setSaving(null);
    }
  };

  const updateDepartment = (id: string, updates: Partial<Department>) => {
    setDepartments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  };

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
              <CardTitle className="flex items-center gap-2">
                <Building2 size={20} />
                Department Roster Configuration
              </CardTitle>
              <CardDescription>
                Configure work/off days and rotation settings per department
              </CardDescription>
            </div>
            <Button variant="outline" onClick={fetchDepartments} size="sm" className="gap-2">
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className={`p-4 rounded-lg border ${
                  dept.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <span className="font-medium text-foreground">{dept.name}</span>
                    {!dept.is_active && (
                      <span className="text-xs text-muted-foreground">(Inactive)</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Work Days</Label>
                      <Input
                        type="number"
                        value={dept.work_days_per_cycle}
                        onChange={(e) =>
                          updateDepartment(dept.id, {
                            work_days_per_cycle: parseInt(e.target.value) || 5,
                          })
                        }
                        min={1}
                        max={7}
                        className="w-16 h-8"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Off Days</Label>
                      <Input
                        type="number"
                        value={dept.off_days_per_cycle}
                        onChange={(e) =>
                          updateDepartment(dept.id, {
                            off_days_per_cycle: parseInt(e.target.value) || 2,
                          })
                        }
                        min={0}
                        max={3}
                        className="w-16 h-8"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Rotation</Label>
                      <Switch
                        checked={dept.rotation_enabled}
                        onCheckedChange={(checked) =>
                          updateDepartment(dept.id, { rotation_enabled: checked })
                        }
                      />
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleUpdate(dept)}
                      disabled={saving === dept.id}
                      className="gap-1"
                    >
                      {saving === dept.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {departments.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No departments configured. Add departments in the Departments page.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info size={20} className="text-blue-500 shrink-0" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-700">How Department Settings Work</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Work Days:</strong> Number of working days per rotation cycle</li>
                <li><strong>Off Days:</strong> Number of off days per rotation cycle</li>
                <li><strong>Rotation:</strong> Enable for departments that follow shift rotation</li>
                <li>Non-rotating departments (e.g., HR) get fixed day shifts</li>
                <li>These settings apply when generating monthly rosters</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
