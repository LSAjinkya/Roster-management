import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, Building2, Info, RefreshCw, Calendar, RefreshCcw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Department {
  id: string;
  name: string;
  work_days_per_cycle: number;
  off_days_per_cycle: number;
  rotation_enabled: boolean;
  is_active: boolean;
  week_off_pattern: 'fixed' | 'staggered' | null;
  fixed_off_days: string[] | null;
}

export function DepartmentRosterSettings() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

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
      // Cast week_off_pattern to proper type
      const depts: Department[] = (data || []).map(d => ({
        ...d,
        week_off_pattern: (d.week_off_pattern as 'fixed' | 'staggered' | null) || null,
        fixed_off_days: d.fixed_off_days || null,
      }));
      setDepartments(depts);
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
          week_off_pattern: dept.week_off_pattern,
          fixed_off_days: dept.fixed_off_days,
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

  const toggleFixedDay = (deptId: string, day: string) => {
    const dept = departments.find(d => d.id === deptId);
    if (!dept) return;
    
    const currentDays = dept.fixed_off_days || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    updateDepartment(deptId, { fixed_off_days: newDays });
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
                Configure work/off days, rotation, and week-off patterns per department
              </CardDescription>
            </div>
            <Button variant="outline" onClick={fetchDepartments} size="sm" className="gap-2">
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className={`rounded-lg border ${
                  dept.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                }`}
              >
                {/* Main row */}
                <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <span className="font-medium text-foreground">{dept.name}</span>
                    {!dept.is_active && (
                      <span className="text-xs text-muted-foreground">(Inactive)</span>
                    )}
                    {dept.week_off_pattern && (
                      <Badge variant="outline" className="text-[10px]">
                        {dept.week_off_pattern === 'fixed' ? 'Fixed Off' : 'Staggered'}
                      </Badge>
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
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
                      className="text-xs"
                    >
                      Week-Off Pattern
                    </Button>

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

                {/* Expanded week-off pattern section */}
                {expandedDept === dept.id && (
                  <div className="px-4 pb-4 border-t pt-4 space-y-4 bg-muted/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-medium">Week-Off Pattern Override</Label>
                      <Badge variant="secondary" className="text-[10px]">
                        Leave empty to use global setting
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Use Global */}
                      <div
                        onClick={() => updateDepartment(dept.id, { week_off_pattern: null, fixed_off_days: null })}
                        className={cn(
                          "relative p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-sm",
                          dept.week_off_pattern === null
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {dept.week_off_pattern === null && (
                          <div className="absolute top-2 right-2">
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <h4 className="font-medium text-sm">Use Global</h4>
                          <p className="text-xs text-muted-foreground">
                            Inherit from Weekly Off Policy
                          </p>
                        </div>
                      </div>

                      {/* Fixed */}
                      <div
                        onClick={() => updateDepartment(dept.id, { 
                          week_off_pattern: 'fixed', 
                          fixed_off_days: dept.fixed_off_days || ['Saturday', 'Sunday'] 
                        })}
                        className={cn(
                          "relative p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-sm",
                          dept.week_off_pattern === 'fixed'
                            ? "border-orange-500 bg-orange-500/5"
                            : "border-border hover:border-orange-500/50"
                        )}
                      >
                        {dept.week_off_pattern === 'fixed' && (
                          <div className="absolute top-2 right-2">
                            <div className="h-5 w-5 rounded-full bg-orange-500 flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-orange-600" />
                          <h4 className="font-medium text-sm">Fixed</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Same days off (e.g., weekends)
                        </p>
                      </div>

                      {/* Staggered */}
                      <div
                        onClick={() => updateDepartment(dept.id, { week_off_pattern: 'staggered', fixed_off_days: null })}
                        className={cn(
                          "relative p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-sm",
                          dept.week_off_pattern === 'staggered'
                            ? "border-blue-500 bg-blue-500/5"
                            : "border-border hover:border-blue-500/50"
                        )}
                      >
                        {dept.week_off_pattern === 'staggered' && (
                          <div className="absolute top-2 right-2">
                            <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                          <RefreshCcw className="h-4 w-4 text-blue-600" />
                          <h4 className="font-medium text-sm">Staggered</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Rotating, distributed offs
                        </p>
                      </div>
                    </div>

                    {/* Fixed days selector */}
                    {dept.week_off_pattern === 'fixed' && (
                      <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                        <Label className="text-xs text-orange-700 mb-2 block">Select Fixed Off Days</Label>
                        <div className="grid grid-cols-7 gap-1">
                          {DAYS_OF_WEEK.map((day) => (
                            <div
                              key={day}
                              className={cn(
                                "p-1.5 rounded text-center cursor-pointer transition-all text-xs",
                                (dept.fixed_off_days || []).includes(day)
                                  ? "bg-orange-500 text-white scale-105"
                                  : "bg-muted/50 hover:bg-muted"
                              )}
                              onClick={() => toggleFixedDay(dept.id, day)}
                            >
                              {day.slice(0, 3)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                <li><strong>Week-Off Pattern:</strong> Override global pattern per department</li>
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
