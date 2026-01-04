import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, CalendarIcon, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

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

export function RosterDCTransferButton() {
  const { canEditShifts } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [datacenters, setDatacenters] = useState<Datacenter[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  
  // Form state
  const [selectedMember, setSelectedMember] = useState('');
  const [targetDC, setTargetDC] = useState('');
  const [transferDate, setTransferDate] = useState<Date>();
  const [shiftType, setShiftType] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  async function fetchData() {
    setLoadingData(true);
    try {
      const [dcsRes, membersRes] = await Promise.all([
        supabase
          .from('datacenters')
          .select('id, name, code')
          .eq('is_active', true),
        supabase
          .from('team_members')
          .select('id, name, department, datacenter_id')
          .eq('department', 'Infra')
          .eq('status', 'available')
      ]);

      if (dcsRes.error) throw dcsRes.error;
      if (membersRes.error) throw membersRes.error;

      setDatacenters(dcsRes.data || []);
      setMembers(membersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoadingData(false);
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
      
      toast.success('DC Transfer created successfully');
      resetForm();
      setOpen(false);
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

  // Only show for users who can edit shifts
  if (!canEditShifts) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <ArrowRightLeft size={16} />
        <span className="hidden sm:inline">DC Transfer</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Quick DC Staff Transfer</DialogTitle>
            <DialogDescription>
              Transfer an Infra team member to another datacenter for a specific shift
            </DialogDescription>
          </DialogHeader>

          {loadingData ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No Infra team members found. Add team members to the Infra department first.
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
                  placeholder="e.g., Staff shortage, Special maintenance, Training"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || loadingData || members.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
