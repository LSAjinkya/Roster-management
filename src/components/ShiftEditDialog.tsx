import { useState } from 'react';
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

  const handleSave = () => {
    if (member && date) {
      onSave(member.id, format(date, 'yyyy-MM-dd'), selectedShift);
      onOpenChange(false);
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
                <span className="text-lg font-bold">CO</span>
                <span className="text-sm font-medium">Comp Off</span>
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
                <span className="text-sm font-medium">Weekly Off</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
