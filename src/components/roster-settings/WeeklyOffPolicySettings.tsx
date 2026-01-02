import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, CalendarDays, Info } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface WeeklyOffPolicy {
  enabled: boolean;
  defaultOffDays: number;
  maxOffDays: number;
  allowConsecutive: boolean;
  fixedDays: string[];
  rotatingOff: boolean;
  allowWeekendSplit: boolean;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_POLICY: WeeklyOffPolicy = {
  enabled: true,
  defaultOffDays: 2,
  maxOffDays: 2,
  allowConsecutive: true,
  fixedDays: [],
  rotatingOff: true,
  allowWeekendSplit: false,
};

export function WeeklyOffPolicySettings() {
  const [policy, setPolicy] = useState<WeeklyOffPolicy>(DEFAULT_POLICY);
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
        .eq('key', 'weekly_off_policy')
        .maybeSingle();

      if (error) throw error;
      if (data?.value) {
        setPolicy({ ...DEFAULT_POLICY, ...(data.value as object) });
      }
    } catch (error) {
      console.error('Error fetching weekly off policy:', error);
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
        .eq('key', 'weekly_off_policy')
        .maybeSingle();

      let error;
      if (existing) {
        const result = await supabase
          .from('app_settings')
          .update({ value: policy as unknown as Json, description: 'Weekly off policy configuration' })
          .eq('key', 'weekly_off_policy');
        error = result.error;
      } else {
        const result = await supabase
          .from('app_settings')
          .insert([{ key: 'weekly_off_policy', value: policy as unknown as Json, description: 'Weekly off policy configuration' }]);
        error = result.error;
      }

      if (error) throw error;
      toast.success('Weekly off policy saved successfully');
    } catch (error) {
      console.error('Error saving weekly off policy:', error);
      toast.error('Failed to save weekly off policy');
    } finally {
      setSaving(false);
    }
  };

  const toggleFixedDay = (day: string) => {
    const newDays = policy.fixedDays.includes(day)
      ? policy.fixedDays.filter(d => d !== day)
      : [...policy.fixedDays, day];
    setPolicy({ ...policy, fixedDays: newDays });
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
            <CalendarDays size={20} />
            Weekly Off Policy Configuration
          </CardTitle>
          <CardDescription>
            Configure weekly off rules that apply during roster generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="space-y-1">
              <Label className="text-base font-medium">Enable Weekly Off Policy</Label>
              <p className="text-sm text-muted-foreground">
                Automatically assign weekly offs during roster generation
              </p>
            </div>
            <Switch
              checked={policy.enabled}
              onCheckedChange={(checked) => setPolicy({ ...policy, enabled: checked })}
            />
          </div>

          {policy.enabled && (
            <>
              {/* Default Off Days */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Default Weekly Off Days</Label>
                  <Badge variant="outline">{policy.defaultOffDays} days</Badge>
                </div>
                <Slider
                  value={[policy.defaultOffDays]}
                  onValueChange={([value]) => setPolicy({ ...policy, defaultOffDays: value })}
                  max={3}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Max Off Days */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Maximum Weekly Off Days</Label>
                  <Badge variant="outline">{policy.maxOffDays} days</Badge>
                </div>
                <Slider
                  value={[policy.maxOffDays]}
                  onValueChange={([value]) => setPolicy({ ...policy, maxOffDays: value })}
                  max={3}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Rotating Off */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <Label>Rotating Weekly Offs</Label>
                  <p className="text-sm text-muted-foreground">
                    Weekly off days rotate through the week for fairness
                  </p>
                </div>
                <Switch
                  checked={policy.rotatingOff}
                  onCheckedChange={(checked) => setPolicy({ ...policy, rotatingOff: checked })}
                />
              </div>

              {/* Allow Consecutive */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <Label>Allow Consecutive Off Days</Label>
                  <p className="text-sm text-muted-foreground">
                    Weekly offs can be on consecutive days
                  </p>
                </div>
                <Switch
                  checked={policy.allowConsecutive}
                  onCheckedChange={(checked) => setPolicy({ ...policy, allowConsecutive: checked })}
                />
              </div>

              {/* Allow Weekend Split */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <Label>Allow Weekend Split</Label>
                  <p className="text-sm text-muted-foreground">
                    One off can be Saturday and one Sunday
                  </p>
                </div>
                <Switch
                  checked={policy.allowWeekendSplit}
                  onCheckedChange={(checked) => setPolicy({ ...policy, allowWeekendSplit: checked })}
                />
              </div>

              {/* Fixed Days */}
              {!policy.rotatingOff && (
                <div className="space-y-3">
                  <Label>Fixed Off Days</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Select default off days (applies when rotating is disabled)
                  </p>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div
                        key={day}
                        className={`p-2 rounded-lg border text-center cursor-pointer transition-colors ${
                          policy.fixedDays.includes(day)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                        onClick={() => toggleFixedDay(day)}
                      >
                        <span className="text-xs font-medium">{day.slice(0, 3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Weekly Off Policy
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
              <p className="font-medium text-blue-700">How Weekly Off Policy Works</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Settings apply when generating monthly rosters</li>
                <li>Department settings can override these defaults</li>
                <li>Individual member entitlements are respected</li>
                <li>Rotating offs ensure fair distribution across team</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
