import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Loader2, HandHelping } from 'lucide-react';

const ROLE_OPTIONS = [
  { value: 'tl', label: 'Team Lead', description: 'Manage team shifts and approve leave requests' },
  { value: 'hr', label: 'HR', description: 'Full access to user management and leave policies' },
  { value: 'admin', label: 'Admin', description: 'Full system access including settings' },
];

interface PermissionRequestDialogProps {
  trigger?: React.ReactNode;
}

export function PermissionRequestDialog({ trigger }: PermissionRequestDialogProps) {
  const { user, roles } = useAuth();
  const [open, setOpen] = useState(false);
  const [requestedRole, setRequestedRole] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter out roles the user already has
  const availableRoles = ROLE_OPTIONS.filter(
    role => !roles.includes(role.value as any)
  );

  const handleSubmit = async () => {
    if (!requestedRole || !reason.trim()) {
      toast.error('Please select a role and provide a reason');
      return;
    }

    if (!user?.id) {
      toast.error('You must be logged in');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('permission_requests')
        .insert({
          requester_id: user.id,
          requested_role: requestedRole,
          reason: reason.trim(),
        });

      if (error) throw error;

      toast.success('Permission request submitted successfully');
      setOpen(false);
      setRequestedRole('');
      setReason('');
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (availableRoles.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <HandHelping className="h-4 w-4" />
            Request Permissions
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Request Elevated Permissions
          </DialogTitle>
          <DialogDescription>
            Submit a request for elevated permissions. An admin will review your request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Role Requested</Label>
            <Select value={requestedRole} onValueChange={setRequestedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {availableRoles.map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{role.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {requestedRole && (
              <p className="text-xs text-muted-foreground">
                {ROLE_OPTIONS.find(r => r.value === requestedRole)?.description}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Reason for Request</Label>
            <Textarea
              placeholder="Explain why you need this permission..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Provide a clear justification for the permission request
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !requestedRole || !reason.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
