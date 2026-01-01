import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Home, Building2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HybridWorkSettingsProps {
  memberId: string;
  memberName: string;
  isHybrid?: boolean;
  officeDays?: number;
  wfhDays?: number;
  onUpdate?: () => void;
}

export function HybridWorkSettings({
  memberId,
  memberName,
  isHybrid = false,
  officeDays = 5,
  wfhDays = 0,
  onUpdate,
}: HybridWorkSettingsProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hybrid, setHybrid] = useState(isHybrid);
  const [office, setOffice] = useState(officeDays);
  const [wfh, setWfh] = useState(wfhDays);

  const handleSave = async () => {
    // Validate: office + wfh should be 5 (work days per week)
    if (hybrid && office + wfh !== 5) {
      toast.error('Office days + WFH days must equal 5');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({
          is_hybrid: hybrid,
          hybrid_office_days: hybrid ? office : 5,
          hybrid_wfh_days: hybrid ? wfh : 0,
        })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Hybrid work settings updated');
      setOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating hybrid settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleOfficeChange = (value: number) => {
    const newOffice = Math.max(0, Math.min(5, value));
    setOffice(newOffice);
    setWfh(5 - newOffice);
  };

  const handleWfhChange = (value: number) => {
    const newWfh = Math.max(0, Math.min(5, value));
    setWfh(newWfh);
    setOffice(5 - newWfh);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2">
          <Home size={14} />
          {isHybrid ? `${officeDays}/${wfhDays}` : 'Office'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hybrid Work Settings - {memberName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enable Hybrid Working</Label>
              <p className="text-sm text-muted-foreground">
                Allow split between office and work from home
              </p>
            </div>
            <Switch checked={hybrid} onCheckedChange={setHybrid} />
          </div>

          {hybrid && (
            <div className="space-y-4 animate-in fade-in-50">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 size={14} />
                    Office Days
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    value={office}
                    onChange={(e) => handleOfficeChange(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Home size={14} />
                    WFH Days
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    value={wfh}
                    onChange={(e) => handleWfhChange(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  {memberName} will work <strong>{office} days from office</strong> and{' '}
                  <strong>{wfh} days from home</strong> per week.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
