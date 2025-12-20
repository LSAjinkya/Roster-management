import { useState, useMemo } from 'react';
import { TeamMember, ShiftType, SHIFT_DEFINITIONS } from '@/types/roster';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ShiftSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  date: Date | null;
  currentShift: ShiftType | null;
  teamMembers: TeamMember[];
  getShiftForMember: (memberId: string, date: Date) => ShiftType | null;
  onSwapComplete?: () => void;
}

const shiftColors: Record<ShiftType, string> = {
  morning: 'bg-shift-morning text-amber-900',
  afternoon: 'bg-shift-afternoon text-sky-900',
  night: 'bg-shift-night text-violet-900',
  general: 'bg-shift-general text-emerald-900',
  leave: 'bg-red-100 text-red-700',
  'comp-off': 'bg-orange-100 text-orange-700',
};

const shiftLabels: Record<ShiftType, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
  general: 'General',
  leave: 'Leave',
  'comp-off': 'Comp Off',
};

export function ShiftSwapDialog({
  open,
  onOpenChange,
  member,
  date,
  currentShift,
  teamMembers,
  getShiftForMember,
  onSwapComplete,
}: ShiftSwapDialogProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [swapping, setSwapping] = useState(false);

  // Get eligible members for swap (same department, different shift on same day)
  const eligibleMembers = useMemo(() => {
    if (!member || !date) return [];
    
    return teamMembers.filter(m => {
      if (m.id === member.id) return false;
      // Same department for easier management
      if (m.department !== member.department) return false;
      // Has a shift on the same day
      const theirShift = getShiftForMember(m.id, date);
      return theirShift !== null && theirShift !== currentShift;
    });
  }, [member, date, teamMembers, getShiftForMember, currentShift]);

  const selectedMember = teamMembers.find(m => m.id === selectedMemberId);
  const selectedMemberShift = selectedMember && date ? getShiftForMember(selectedMember.id, date) : null;

  const handleSwap = async () => {
    if (!member || !date || !selectedMember || !currentShift || !selectedMemberShift) return;
    
    setSwapping(true);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    try {
      // Update first member's shift to the second member's shift
      const { error: error1 } = await supabase
        .from('shift_assignments')
        .update({ shift_type: selectedMemberShift })
        .eq('member_id', member.id)
        .eq('date', dateStr);

      if (error1) throw error1;

      // Update second member's shift to the first member's shift
      const { error: error2 } = await supabase
        .from('shift_assignments')
        .update({ shift_type: currentShift })
        .eq('member_id', selectedMember.id)
        .eq('date', dateStr);

      if (error2) throw error2;

      toast.success('Shifts swapped successfully!', {
        description: `${member.name} and ${selectedMember.name} exchanged shifts.`,
      });
      
      onOpenChange(false);
      setSelectedMemberId('');
      onSwapComplete?.();
    } catch (error) {
      console.error('Error swapping shifts:', error);
      toast.error('Failed to swap shifts', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setSwapping(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setSelectedMemberId('');
    }
  };

  if (!member || !date) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight size={20} />
            Swap Shifts
          </DialogTitle>
          <DialogDescription>
            Exchange shifts between two team members for {format(date, 'EEEE, MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current member's shift */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <Label className="text-sm text-muted-foreground">Current Assignment</Label>
            <div className="flex items-center justify-between mt-2">
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-sm text-muted-foreground">{member.department}</p>
              </div>
              {currentShift && (
                <Badge className={cn("text-sm", shiftColors[currentShift])}>
                  {shiftLabels[currentShift]}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowLeftRight className="text-muted-foreground" />
          </div>

          {/* Member to swap with */}
          <div className="space-y-2">
            <Label>Swap with</Label>
            {eligibleMembers.length > 0 ? (
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleMembers.map(m => {
                    const theirShift = getShiftForMember(m.id, date);
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <span>{m.name}</span>
                          {theirShift && (
                            <Badge variant="outline" className={cn("text-xs", shiftColors[theirShift])}>
                              {shiftLabels[theirShift]}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
                No eligible team members found for swap. Members must be in the same department with a different shift on this day.
              </p>
            )}
          </div>

          {/* Preview */}
          {selectedMember && selectedMemberShift && (
            <div className="rounded-lg border p-4 bg-primary/5">
              <Label className="text-sm text-muted-foreground">After Swap</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{member.name}</span>
                  <Badge className={cn(shiftColors[selectedMemberShift])}>
                    {shiftLabels[selectedMemberShift]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{selectedMember.name}</span>
                  <Badge className={cn(shiftColors[currentShift!])}>
                    {shiftLabels[currentShift!]}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={swapping}>
            Cancel
          </Button>
          <Button 
            onClick={handleSwap} 
            disabled={swapping || !selectedMemberId || !selectedMemberShift}
          >
            {swapping ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Swapping...
              </>
            ) : (
              <>
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Confirm Swap
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
