import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, Minus } from 'lucide-react';

interface LeaveBalanceAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: {
    id: string;
    user_id: string;
    casual_leave_total: number;
    casual_leave_used: number;
    sick_leave_total: number;
    sick_leave_used: number;
    public_holidays_total: number;
    public_holidays_used: number;
    profile?: {
      full_name: string;
    };
  } | null;
  onSuccess: () => void;
}

type LeaveType = 'casual' | 'sick' | 'public';
type AdjustmentType = 'add' | 'deduct';
type FieldType = 'total' | 'used';

export function LeaveBalanceAdjustDialog({ 
  open, 
  onOpenChange, 
  balance, 
  onSuccess 
}: LeaveBalanceAdjustDialogProps) {
  const [leaveType, setLeaveType] = useState<LeaveType>('casual');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('add');
  const [fieldType, setFieldType] = useState<FieldType>('total');
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!balance || !days || parseInt(days) <= 0) {
      toast({
        title: 'Invalid input',
        description: 'Please enter a valid number of days',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const adjustment = adjustmentType === 'add' ? parseInt(days) : -parseInt(days);
      
      // Get the column name based on leave type and field type
      const columnMap: Record<LeaveType, Record<FieldType, string>> = {
        casual: { total: 'casual_leave_total', used: 'casual_leave_used' },
        sick: { total: 'sick_leave_total', used: 'sick_leave_used' },
        public: { total: 'public_holidays_total', used: 'public_holidays_used' },
      };

      const column = columnMap[leaveType][fieldType];
      const currentValue = balance[column as keyof typeof balance] as number;
      const newValue = Math.max(0, currentValue + adjustment);

      const { error } = await supabase
        .from('leave_balances')
        .update({ [column]: newValue })
        .eq('id', balance.id);

      if (error) throw error;

      toast({
        title: 'Balance updated',
        description: `${adjustmentType === 'add' ? 'Added' : 'Deducted'} ${days} days ${fieldType === 'total' ? 'to total' : 'from used'} ${leaveType} leave for ${balance.profile?.full_name || 'employee'}`,
      });

      // Reset form
      setDays('');
      setReason('');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error adjusting balance:', error);
      toast({
        title: 'Error',
        description: 'Failed to update leave balance',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!balance) return null;

  const leaveTypeLabels: Record<LeaveType, string> = {
    casual: 'Casual Leave',
    sick: 'Sick Leave',
    public: 'Public Holidays',
  };

  const getCurrentValue = () => {
    const columnMap: Record<LeaveType, Record<FieldType, keyof typeof balance>> = {
      casual: { total: 'casual_leave_total', used: 'casual_leave_used' },
      sick: { total: 'sick_leave_total', used: 'sick_leave_used' },
      public: { total: 'public_holidays_total', used: 'public_holidays_used' },
    };
    return balance[columnMap[leaveType][fieldType]] as number;
  };

  const getPreviewValue = () => {
    const current = getCurrentValue();
    const adjustment = adjustmentType === 'add' ? parseInt(days || '0') : -parseInt(days || '0');
    return Math.max(0, current + adjustment);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Leave Balance</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="font-medium">{balance.profile?.full_name || 'Unknown'}</p>
            <p className="text-sm text-muted-foreground">
              Current: {leaveTypeLabels[leaveType]} - {fieldType === 'total' ? 'Total' : 'Used'}: {getCurrentValue()} days
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="public">Public Holidays</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Adjust Field</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Total Allowed</SelectItem>
                  <SelectItem value="used">Days Used</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={adjustmentType === 'add' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setAdjustmentType('add')}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
                <Button
                  type="button"
                  variant={adjustmentType === 'deduct' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setAdjustmentType('deduct')}
                >
                  <Minus className="h-4 w-4 mr-1" /> Deduct
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="days">Days</Label>
              <Input
                id="days"
                type="number"
                min="1"
                max="365"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="Enter days"
              />
            </div>
          </div>

          {days && parseInt(days) > 0 && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium">Preview</p>
              <p className="text-sm text-muted-foreground">
                {getCurrentValue()} → <span className="font-bold text-foreground">{getPreviewValue()}</span> days
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for adjustment..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !days || parseInt(days) <= 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Apply Adjustment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
