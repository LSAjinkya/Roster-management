import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, Save, RotateCcw } from 'lucide-react';
import { RotationConfig } from '@/types/shiftRules';

export function RotationConfigManager() {
  const [config, setConfig] = useState<RotationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('rotation_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error('Error fetching rotation config:', error);
      toast.error('Failed to load rotation configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('rotation_config')
        .update({
          rotation_cycle_days: config.rotation_cycle_days,
          max_consecutive_nights: config.max_consecutive_nights,
          min_rest_hours: config.min_rest_hours,
          work_days: config.work_days,
          off_days: config.off_days,
        })
        .eq('id', config.id);

      if (error) throw error;
      toast.success('Configuration saved');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(prev => prev ? {
      ...prev,
      rotation_cycle_days: 15,
      max_consecutive_nights: 5,
      min_rest_hours: 12,
      work_days: 5,
      off_days: 2,
    } : null);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading configuration...</div>;
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            No rotation configuration found. Please contact an administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings size={20} />
              Rotation Configuration
            </CardTitle>
            <CardDescription>
              Configure shift rotation patterns and constraints
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw size={16} />
              Reset Defaults
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Work Pattern */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 p-4 rounded-lg border">
            <h3 className="font-medium">Work Pattern (5+2 Rotation)</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Work Days per Cycle</Label>
                <span className="text-sm font-medium">{config.work_days} days</span>
              </div>
              <Slider
                value={[config.work_days]}
                onValueChange={([v]) => setConfig({ ...config, work_days: v })}
                min={4}
                max={6}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Off Days per Cycle</Label>
                <span className="text-sm font-medium">{config.off_days} days</span>
              </div>
              <Slider
                value={[config.off_days]}
                onValueChange={([v]) => setConfig({ ...config, off_days: v })}
                min={1}
                max={3}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Rotation Cycle Length</Label>
                <span className="text-sm font-medium">{config.rotation_cycle_days} days</span>
              </div>
              <Slider
                value={[config.rotation_cycle_days]}
                onValueChange={([v]) => setConfig({ ...config, rotation_cycle_days: v })}
                min={7}
                max={30}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Shift pattern repeats after this many days
              </p>
            </div>
          </div>

          <div className="space-y-4 p-4 rounded-lg border">
            <h3 className="font-medium">Constraints</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Max Consecutive Night Shifts</Label>
                <span className="text-sm font-medium">{config.max_consecutive_nights} nights</span>
              </div>
              <Slider
                value={[config.max_consecutive_nights]}
                onValueChange={([v]) => setConfig({ ...config, max_consecutive_nights: v })}
                min={1}
                max={7}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Workers won't be assigned more consecutive night shifts than this
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Minimum Rest Hours Between Shifts</Label>
                <span className="text-sm font-medium">{config.min_rest_hours} hours</span>
              </div>
              <Slider
                value={[config.min_rest_hours]}
                onValueChange={([v]) => setConfig({ ...config, min_rest_hours: v })}
                min={8}
                max={16}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Ensures adequate rest between consecutive shift days
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 rounded-lg bg-muted/50">
          <h4 className="font-medium mb-2">Current Pattern Summary</h4>
          <p className="text-sm text-muted-foreground">
            Workers will work <strong>{config.work_days} days</strong> followed by{' '}
            <strong>{config.off_days} days off</strong> in a rotating pattern. 
            Shifts rotate every <strong>{config.rotation_cycle_days} days</strong>. 
            No worker will have more than <strong>{config.max_consecutive_nights} consecutive night shifts</strong>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
