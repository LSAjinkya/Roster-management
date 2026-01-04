import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, Home, Info } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WfhPolicy {
  enabled: boolean;
  defaultWfhDays: number;
  maxWfhDays: number;
  minOfficeDays: number;
  nightShiftWfhAllowed: boolean;
  requireApproval: boolean;
  eligibleAfterDays: number;
}

const DEFAULT_POLICY: WfhPolicy = {
  enabled: true,
  defaultWfhDays: 2,
  maxWfhDays: 3,
  minOfficeDays: 2,
  nightShiftWfhAllowed: true,
  requireApproval: false,
  eligibleAfterDays: 90,
};

export function WfhPolicySettings() {
  const [policy, setPolicy] = useState<WfhPolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'wfh_policy')
        .maybeSingle();

      if (error) throw error;
      if (data?.value) {
        setPolicy({ ...DEFAULT_POLICY, ...(data.value as object) });
      }
    } catch (error) {
      console.error('Error fetching WFH policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // First check if record exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'wfh_policy')
        .maybeSingle();

      let error;
      if (existing) {
        const result = await supabase
          .from('app_settings')
          .update({ value: policy as unknown as Json, description: 'Work From Home policy configuration' })
          .eq('key', 'wfh_policy');
        error = result.error;
      } else {
        const result = await supabase
          .from('app_settings')
          .insert([{ key: 'wfh_policy', value: policy as unknown as Json, description: 'Work From Home policy configuration' }]);
        error = result.error;
      }

      if (error) throw error;
      toast.success('WFH policy saved successfully');
    } catch (error) {
      console.error('Error saving WFH policy:', error);
      toast.error('Failed to save WFH policy');
    } finally {
      setSaving(false);
    }
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
            <Home size={20} />
            WFH Policy Configuration
          </CardTitle>
          <CardDescription>
            Configure work from home rules that apply during roster generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="space-y-1">
              <Label className="text-base font-medium">Enable WFH Policy</Label>
              <p className="text-sm text-muted-foreground">
                When disabled, all team members work from office
              </p>
            </div>
            <Switch
              checked={policy.enabled}
              onCheckedChange={(checked) => setPolicy({ ...policy, enabled: checked })}
            />
          </div>

          {policy.enabled && (
            <>
              {/* Default WFH Days */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Default WFH Days per Week</Label>
                  <Input
                    type="number"
                    value={policy.defaultWfhDays}
                    onChange={(e) => setPolicy({ ...policy, defaultWfhDays: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={5}
                    className="w-20 h-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Default number of WFH days assigned to new team members
                </p>
              </div>

              {/* Max WFH Days */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Maximum WFH Days per Week</Label>
                  <Input
                    type="number"
                    value={policy.maxWfhDays}
                    onChange={(e) => setPolicy({ ...policy, maxWfhDays: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={5}
                    className="w-20 h-8"
                  />
                </div>
              </div>

              {/* Min Office Days */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Minimum Office Days per Week</Label>
                  <Input
                    type="number"
                    value={policy.minOfficeDays}
                    onChange={(e) => setPolicy({ ...policy, minOfficeDays: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={5}
                    className="w-20 h-8"
                  />
                </div>
              </div>

              {/* Night Shift WFH */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <Label>Allow WFH for Night Shifts</Label>
                  <p className="text-sm text-muted-foreground">
                    Team members on night shift can work from home
                  </p>
                </div>
                <Switch
                  checked={policy.nightShiftWfhAllowed}
                  onCheckedChange={(checked) => setPolicy({ ...policy, nightShiftWfhAllowed: checked })}
                />
              </div>

              {/* Require Approval */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <Label>Require TL Approval for WFH</Label>
                  <p className="text-sm text-muted-foreground">
                    WFH requests need approval from team lead
                  </p>
                </div>
                <Switch
                  checked={policy.requireApproval}
                  onCheckedChange={(checked) => setPolicy({ ...policy, requireApproval: checked })}
                />
              </div>

              {/* Eligibility Period */}
              <div className="space-y-2">
                <Label>WFH Eligibility (Days After Joining)</Label>
                <Input
                  type="number"
                  value={policy.eligibleAfterDays}
                  onChange={(e) => setPolicy({ ...policy, eligibleAfterDays: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={365}
                />
                <p className="text-xs text-muted-foreground">
                  New employees are eligible for WFH after this many days
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save WFH Policy
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
              <p className="font-medium text-blue-700">How WFH Policy Works</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>These settings apply when generating monthly rosters</li>
                <li>Individual member WFH settings can override the default</li>
                <li>Night shift WFH is controlled by location settings</li>
                <li>TL approval is tracked in the leave/request system</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
