import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Home, Loader2 } from 'lucide-react';
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
  const [officePattern, setOfficePattern] = useState<number[]>([1, 2, 3, 4, 5]); // Default all office days

  const WEEKDAYS = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
  ];

  // Derive WFH days from office days
  const wfhPattern = WEEKDAYS
    .map(d => d.value)
    .filter(d => !officePattern.includes(d));

  const toggleOfficeDay = (day: number) => {
    setOfficePattern(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSave = async () => {
    const wfhCount = wfhPattern.length;
    const officeCount = officePattern.length;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({
          is_hybrid: hybrid,
          hybrid_office_days: hybrid ? officeCount : 5,
          hybrid_wfh_days: hybrid ? wfhCount : 0,
          hybrid_wfh_days_pattern: hybrid && wfhPattern.length > 0 ? wfhPattern : null,
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
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Home size={14} />
                  Select Office Days
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleOfficeDay(day.value)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        officePattern.includes(day.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted text-muted-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select days to work from office. Remaining days will be WFH.
                </p>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                <p className="text-foreground">
                  <strong>{officePattern.length} days from office</strong>
                  {officePattern.length > 0 && (
                    <span className="text-muted-foreground">
                      {' '}({officePattern.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')})
                    </span>
                  )}
                </p>
                <p className="text-foreground">
                  <strong>{wfhPattern.length} days from home</strong>
                  {wfhPattern.length > 0 && (
                    <span className="text-muted-foreground">
                      {' '}({wfhPattern.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')})
                    </span>
                  )}
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
