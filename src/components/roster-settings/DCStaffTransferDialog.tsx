import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Datacenter {
  id: string;
  name: string;
  code: string;
}

interface TeamMember {
  id: string;
  name: string;
  department: string;
  datacenter_id: string | null;
}

interface DCStaffTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datacenters: Datacenter[];
  onSuccess: () => void;
}

export function DCStaffTransferDialog({ open, onOpenChange, datacenters, onSuccess }: DCStaffTransferDialogProps) {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  
  // Form state
  const [selectedMember, setSelectedMember] = useState('');
  const [targetDC, setTargetDC] = useState('');
  const [transferDate, setTransferDate] = useState<Date>();
  const [shiftType, setShiftType] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      fetchInfraMembers();
    }
  }, [open]);

  async function fetchInfraMembers() {
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, department, datacenter_id')
        .eq('department', 'Infra')
        .eq('status', 'available');
      
      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoadingMembers(false);
    }
  }

  function getSourceDC(memberId: string) {
    const member = members.find(m => m.id === memberId);
    return member?.datacenter_id || null;
  }

  async function handleSubmit() {
    if (!selectedMember || !targetDC || !transferDate || !shiftType || !reason.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('dc_staff_transfers')
        .insert({
          member_id: selectedMember,
          source_datacenter_id: getSourceDC(selectedMember),
          target_datacenter_id: targetDC,
          transfer_date: format(transferDate, 'yyyy-MM-dd'),
          shift_type: shiftType,
          reason: reason.trim(),
          status: 'active'
        });
      
      if (error) throw error;
      
      toast.success('Transfer created successfully');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast.error('Failed to create transfer');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSelectedMember('');
    setTargetDC('');
    setTransferDate(undefined);
    setShiftType('');
    setReason('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create DC Staff Transfer</DialogTitle>
          <DialogDescription>
            Transfer a staff member to another datacenter for a specific shift
          </DialogDescription>
        </DialogHeader>

        {loadingMembers ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Staff Member</Label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMember && (
                <p className="text-sm text-muted-foreground">
                  Current DC: {datacenters.find(dc => dc.id === getSourceDC(selectedMember))?.name || 'Not assigned'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Target Datacenter</Label>
              <Select value={targetDC} onValueChange={setTargetDC}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target DC" />
                </SelectTrigger>
                <SelectContent>
                  {datacenters.map(dc => (
                    <SelectItem key={dc.id} value={dc.id}>
                      {dc.name} ({dc.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Transfer Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !transferDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {transferDate ? format(transferDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={transferDate}
                    onSelect={setTransferDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Shift Type</Label>
              <Select value={shiftType} onValueChange={setShiftType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Transfer Reason</Label>
              <Textarea
                placeholder="Enter reason for transfer (e.g., Staff shortage, Special maintenance, Training)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || loadingMembers}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
