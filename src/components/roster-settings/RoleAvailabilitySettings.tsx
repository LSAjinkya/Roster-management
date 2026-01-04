import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, Users, Info, Sun, Sunset, Moon } from 'lucide-react';
import { ROLES } from '@/types/roster';
import type { Json } from '@/integrations/supabase/types';

interface RoleShiftConfig {
  canWorkMorning: boolean;
  canWorkAfternoon: boolean;
  canWorkNight: boolean;
  rotationEnabled: boolean;
  isExemptFromRotation: boolean;
  priority: number;
}

type RoleAvailabilityConfig = Record<string, RoleShiftConfig>;

const DEFAULT_ROLE_CONFIG: RoleShiftConfig = {
  canWorkMorning: true,
  canWorkAfternoon: true,
  canWorkNight: true,
  rotationEnabled: true,
  isExemptFromRotation: false,
  priority: 5,
};

const getDefaultConfigs = (): RoleAvailabilityConfig => {
  const configs: RoleAvailabilityConfig = {};
  ROLES.forEach((role) => {
    if (role === 'Admin' || role === 'Manager' || role === 'HR') {
      configs[role] = {
        ...DEFAULT_ROLE_CONFIG,
        canWorkNight: false,
        rotationEnabled: false,
        isExemptFromRotation: true,
        priority: role === 'Admin' ? 10 : role === 'Manager' ? 9 : 8,
      };
    } else if (role === 'Trainee') {
      configs[role] = {
        ...DEFAULT_ROLE_CONFIG,
        canWorkNight: false,
        priority: 1,
      };
    } else {
      configs[role] = {
        ...DEFAULT_ROLE_CONFIG,
        priority: role === 'TL' ? 7 : role === 'L3' ? 6 : role === 'L2' ? 4 : 3,
      };
    }
  });
  return configs;
};

export function RoleAvailabilitySettings() {
  const [configs, setConfigs] = useState<RoleAvailabilityConfig>(getDefaultConfigs());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'role_availability_config')
        .maybeSingle();

      if (error) throw error;
      if (data?.value) {
        setConfigs({ ...getDefaultConfigs(), ...(data.value as object) });
      }
    } catch (error) {
      console.error('Error fetching role configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'role_availability_config')
        .maybeSingle();

      let error;
      if (existing) {
        const result = await supabase
          .from('app_settings')
          .update({ value: configs as unknown as Json, description: 'Role-based shift availability configuration' })
          .eq('key', 'role_availability_config');
        error = result.error;
      } else {
        const result = await supabase
          .from('app_settings')
          .insert([{ key: 'role_availability_config', value: configs as unknown as Json, description: 'Role-based shift availability configuration' }]);
        error = result.error;
      }

      if (error) throw error;
      toast.success('Role availability settings saved successfully');
    } catch (error) {
      console.error('Error saving role configs:', error);
      toast.error('Failed to save role availability settings');
    } finally {
      setSaving(false);
    }
  };

  const updateRoleConfig = (role: string, updates: Partial<RoleShiftConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [role]: { ...prev[role], ...updates },
    }));
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
          <CardTitle className="flex items-center gap-2">
            <Users size={20} />
            Role-Based Shift Availability
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Configure which roles can work which shifts and rotation settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">Role</th>
                  <th className="text-center py-3 px-2 font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Sun size={14} className="text-blue-500" />
                      <span>Morning</span>
                    </div>
                  </th>
                  <th className="text-center py-3 px-2 font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Sunset size={14} className="text-amber-500" />
                      <span>Afternoon</span>
                    </div>
                  </th>
                  <th className="text-center py-3 px-2 font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Moon size={14} className="text-purple-500" />
                      <span>Night</span>
                    </div>
                  </th>
                  <th className="text-center py-3 px-2 font-medium">Rotation</th>
                  <th className="text-center py-3 px-2 font-medium">Exempt</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map((role) => {
                  const config = configs[role] || DEFAULT_ROLE_CONFIG;
                  return (
                    <tr key={role} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <span className="font-medium text-foreground">{role}</span>
                      </td>
                      <td className="text-center py-3 px-2">
                        <Checkbox
                          checked={config.canWorkMorning}
                          onCheckedChange={(checked) =>
                            updateRoleConfig(role, { canWorkMorning: !!checked })
                          }
                        />
                      </td>
                      <td className="text-center py-3 px-2">
                        <Checkbox
                          checked={config.canWorkAfternoon}
                          onCheckedChange={(checked) =>
                            updateRoleConfig(role, { canWorkAfternoon: !!checked })
                          }
                        />
                      </td>
                      <td className="text-center py-3 px-2">
                        <Checkbox
                          checked={config.canWorkNight}
                          onCheckedChange={(checked) =>
                            updateRoleConfig(role, { canWorkNight: !!checked })
                          }
                        />
                      </td>
                      <td className="text-center py-3 px-2">
                        <Switch
                          checked={config.rotationEnabled}
                          onCheckedChange={(checked) =>
                            updateRoleConfig(role, { rotationEnabled: checked })
                          }
                          disabled={config.isExemptFromRotation}
                        />
                      </td>
                      <td className="text-center py-3 px-2">
                        <Switch
                          checked={config.isExemptFromRotation}
                          onCheckedChange={(checked) =>
                            updateRoleConfig(role, { 
                              isExemptFromRotation: checked,
                              rotationEnabled: checked ? false : config.rotationEnabled 
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-6">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Role Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info size={20} className="text-blue-500 shrink-0" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-700">How Role Availability Works</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Shift columns:</strong> Check/uncheck to allow role for that shift</li>
                <li><strong>Rotation:</strong> Enable for roles that follow shift rotation cycle</li>
                <li><strong>Exempt:</strong> Roles exempt from rotation get fixed shifts</li>
                <li>Admin, Manager, HR typically don't do night shifts</li>
                <li>Trainees may be restricted from certain shifts</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
