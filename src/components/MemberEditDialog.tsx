import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Home, Loader2, MapPin, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TeamMember, WorkLocation } from '@/types/roster';

interface MemberEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  workLocations: WorkLocation[];
  onUpdate?: () => void;
}

export function MemberEditDialog({
  open,
  onOpenChange,
  member,
  workLocations,
  onUpdate,
}: MemberEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [weekOffEntitlement, setWeekOffEntitlement] = useState<1 | 2>(2);
  const [isHybrid, setIsHybrid] = useState(false);
  const [wfhDaysPattern, setWfhDaysPattern] = useState<number[]>([]);
  const [workLocationId, setWorkLocationId] = useState<string | null>(null);

  const WEEKDAYS = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
  ];

  // Office locations only (exclude datacenters for hybrid users)
  const officeLocations = workLocations.filter(l => l.location_type === 'office' || l.location_type === 'remote');

  useEffect(() => {
    if (member) {
      setWeekOffEntitlement(member.weekOffEntitlement || 2);
      setIsHybrid(member.isHybrid || false);
      setWfhDaysPattern(member.hybridWfhDaysPattern || []);
      setWorkLocationId(member.workLocationId || null);
    }
  }, [member]);

  const toggleWfhDay = (day: number) => {
    setWfhDaysPattern(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSave = async () => {
    if (!member) return;

    const wfhDays = wfhDaysPattern.length;
    const officeDays = 5 - wfhDays;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({
          week_off_entitlement: weekOffEntitlement,
          is_hybrid: isHybrid,
          hybrid_office_days: isHybrid ? officeDays : 5,
          hybrid_wfh_days: isHybrid ? wfhDays : 0,
          hybrid_wfh_days_pattern: isHybrid && wfhDaysPattern.length > 0 ? wfhDaysPattern : null,
          work_location_id: workLocationId,
        })
        .eq('id', member.id);

      if (error) throw error;

      toast.success('Member settings updated');
      onOpenChange(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating member settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Member Settings - {member.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Work Location */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin size={14} />
              Work Location
            </Label>
            <Select
              value={workLocationId || 'unassigned'}
              onValueChange={(v) => setWorkLocationId(v === 'unassigned' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {workLocations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} {loc.city && `(${loc.city})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weekly Off Entitlement */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar size={14} />
              Week-Off Entitlement
            </Label>
            <Select
              value={String(weekOffEntitlement)}
              onValueChange={(v) => setWeekOffEntitlement(parseInt(v) as 1 | 2)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="1">1 day per week</SelectItem>
                <SelectItem value="2">2 days per week</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Number of weekly offs this member is entitled to
            </p>
          </div>

          {/* Hybrid Working Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Hybrid Working</Label>
              <p className="text-sm text-muted-foreground">
                Split between office and work from home
              </p>
            </div>
            <Switch checked={isHybrid} onCheckedChange={setIsHybrid} />
          </div>

          {/* Hybrid Days Configuration */}
          {isHybrid && (
            <div className="space-y-4 animate-in fade-in-50 border-t pt-4">
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Home size={14} />
                  Select WFH Days
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWfhDay(day.value)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        wfhDaysPattern.includes(day.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-secondary'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Click days to toggle WFH. Selected days will be marked as work-from-home.
                </p>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  {member.name} will work{' '}
                  <strong>{5 - wfhDaysPattern.length} days from office</strong> and{' '}
                  <strong>{wfhDaysPattern.length} days from home</strong>
                  {wfhDaysPattern.length > 0 && (
                    <span>
                      {' '}({wfhDaysPattern.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')})
                    </span>
                  )}.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
