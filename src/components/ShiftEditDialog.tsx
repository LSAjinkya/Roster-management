import { useState, useEffect } from 'react';
import { ShiftType, SHIFT_DEFINITIONS, TeamMember } from '@/types/roster';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ShiftEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  date: Date | null;
  currentShift: ShiftType | null;
  onSave: (memberId: string, date: string, shiftType: ShiftType | 'off') => void;
}

const shiftColors: Record<ShiftType | 'off', string> = {
  morning: 'bg-shift-morning',
  afternoon: 'bg-shift-afternoon',
  night: 'bg-shift-night',
  general: 'bg-shift-general',
  leave: 'bg-red-100',
  'comp-off': 'bg-orange-100',
  off: 'bg-muted',
};

export function ShiftEditDialog({
  open,
  onOpenChange,
  member,
  date,
  currentShift,
  onSave,
}: ShiftEditDialogProps) {
  const [selectedShift, setSelectedShift] = useState<ShiftType | 'off'>(currentShift || 'off');
  const [saving, setSaving] = useState(false);

  // Reset selected shift when dialog opens with new data
  useEffect(() => {
    if (open) {
      setSelectedShift(currentShift || 'off');
    }
  }, [open, currentShift]);

  const handleSave = async () => {
    if (!member || !date) return;
    
    setSaving(true);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // First, delete any existing assignment for this member on this date
      const { error: deleteError } = await supabase
        .from('shift_assignments')
        .delete()
        .eq('member_id', member.id)
        .eq('date', dateStr);

      if (deleteError) throw deleteError;

      // If not "off", insert the new assignment
      if (selectedShift !== 'off') {
        const { error: insertError } = await supabase
          .from('shift_assignments')
          .insert({
            member_id: member.id,
            shift_type: selectedShift,
            date: dateStr,
            department: member.department,
          });

        if (insertError) throw insertError;
      }

      // Log to shift history
      const action = !currentShift && selectedShift !== 'off' ? 'create' 
        : selectedShift === 'off' && currentShift ? 'delete' 
        : 'update';
      
      await supabase.from('shift_history').insert({
        member_id: member.id,
        date: dateStr,
        old_shift_type: currentShift,
        new_shift_type: selectedShift === 'off' ? null : selectedShift,
        action,
        changed_by: user?.id,
      });

      toast.success('Shift updated successfully');
      onSave(member.id, dateStr, selectedShift);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving shift:', error);
      toast.error('Failed to save shift', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!member || !date) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Shift Assignment</DialogTitle>
          <DialogDescription>
            {member.name} · {format(date, 'EEEE, MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={selectedShift}
            onValueChange={(value) => setSelectedShift(value as ShiftType | 'off')}
            className="grid grid-cols-2 gap-3"
          >
            {SHIFT_DEFINITIONS.filter(s => !['leave', 'comp-off'].includes(s.id)).map((shift) => (
              <div key={shift.id}>
                <RadioGroupItem
                  value={shift.id}
                  id={shift.id}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={shift.id}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-muted p-4 cursor-pointer transition-all",
                    "hover:bg-accent hover:text-accent-foreground",
                    "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/20",
                    shiftColors[shift.id]
                  )}
                >
                  <span className="text-lg font-bold">{shift.id.charAt(0).toUpperCase()}</span>
                  <span className="text-sm font-medium">{shift.name}</span>
                  {shift.startTime && (
                    <span className="text-xs text-muted-foreground mt-1">
                      {shift.startTime} - {shift.endTime}
                    </span>
                  )}
                </Label>
              </div>
            ))}
            
            <div>
              <RadioGroupItem
                value="leave"
                id="leave"
                className="peer sr-only"
              />
              <Label
                htmlFor="leave"
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 border-muted p-4 cursor-pointer transition-all",
                  "hover:bg-accent hover:text-accent-foreground",
                  "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/20",
                  shiftColors.leave
                )}
              >
                <span className="text-lg font-bold">L</span>
                <span className="text-sm font-medium">Leave</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem
                value="comp-off"
                id="comp-off"
                className="peer sr-only"
              />
              <Label
                htmlFor="comp-off"
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 border-muted p-4 cursor-pointer transition-all",
                  "hover:bg-accent hover:text-accent-foreground",
                  "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/20",
                  shiftColors['comp-off']
                )}
              >
                <span className="text-lg font-bold">WO</span>
                <span className="text-sm font-medium">Weekly Off</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem
                value="off"
                id="off"
                className="peer sr-only"
              />
              <Label
                htmlFor="off"
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 border-muted p-4 cursor-pointer transition-all",
                  "hover:bg-accent hover:text-accent-foreground",
                  "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/20",
                  shiftColors.off
                )}
              >
                <span className="text-lg font-bold">-</span>
                <span className="text-sm font-medium">No Assignment</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
