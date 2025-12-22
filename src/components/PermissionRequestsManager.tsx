import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, XCircle, Clock, Shield } from 'lucide-react';
import { format } from 'date-fns';

interface PermissionRequest {
  id: string;
  requester_id: string;
  requested_role: string;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  requester_name?: string;
  requester_email?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  hr: 'HR',
  tl: 'Team Lead',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-amber-500/20 text-amber-700 border-amber-500/30' },
  approved: { label: 'Approved', icon: CheckCircle, className: 'bg-green-500/20 text-green-700 border-green-500/30' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-red-500/20 text-red-700 border-red-500/30' },
};

export function PermissionRequestsManager() {
  const { user, isAdmin, isHR } = useAuth();
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ request: PermissionRequest; action: 'approve' | 'reject' } | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const canManage = isAdmin || isHR;

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data: requestsData, error } = await supabase
        .from('permission_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch requester profiles
      const requesterIds = [...new Set(requestsData?.map(r => r.requester_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', requesterIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const enrichedRequests: PermissionRequest[] = (requestsData || []).map(r => ({
        ...r,
        requester_name: profileMap.get(r.requester_id)?.full_name || 'Unknown',
        requester_email: profileMap.get(r.requester_id)?.email || '',
      }));

      setRequests(enrichedRequests);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load permission requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionDialog || !user?.id) return;

    setProcessing(true);
    try {
      const { request, action } = actionDialog;

      // Update request status
      const { error: updateError } = await supabase
        .from('permission_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_by: user.id,
          reviewer_notes: reviewerNotes.trim() || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // If approved, add the role
      if (action === 'approve') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: request.requester_id,
            role: request.requested_role as 'admin' | 'hr' | 'tl' | 'member',
          });

        if (roleError && roleError.code !== '23505') {
          throw roleError;
        }
      }

      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      setActionDialog(null);
      setReviewerNotes('');
      fetchRequests();
    } catch (error) {
      console.error('Error processing request:', error);
      toast.error('Failed to process request');
    } finally {
      setProcessing(false);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {canManage && pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pending Permission Requests
              <Badge variant="secondary">{pendingRequests.length}</Badge>
            </CardTitle>
            <CardDescription>Review and approve or reject permission requests</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Role Requested</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.requester_name}</p>
                        <p className="text-xs text-muted-foreground">{request.requester_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-primary/10 text-primary">
                        {ROLE_LABELS[request.requested_role] || request.requested_role}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm truncate">{request.reason}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(request.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:bg-green-500/10"
                          onClick={() => setActionDialog({ request, action: 'approve' })}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setActionDialog({ request, action: 'reject' })}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Requests History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Request History
          </CardTitle>
          <CardDescription>
            {canManage ? 'All permission requests across the organization' : 'Your permission requests'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No permission requests found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  {canManage && <TableHead>Reviewer Notes</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const status = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG];
                  const StatusIcon = status?.icon || Clock;
                  
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.requester_name}</p>
                          <p className="text-xs text-muted-foreground">{request.requester_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ROLE_LABELS[request.requested_role] || request.requested_role}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm truncate" title={request.reason}>{request.reason}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status?.className}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status?.label || request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-sm text-muted-foreground max-w-xs">
                          <p className="truncate">{request.reviewer_notes || '-'}</p>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog?.action === 'approve' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              {actionDialog?.action === 'approve' ? 'Approve' : 'Reject'} Permission Request
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === 'approve'
                ? `This will grant ${ROLE_LABELS[actionDialog?.request.requested_role || ''] || ''} permissions to ${actionDialog?.request.requester_name}.`
                : `This will reject the request from ${actionDialog?.request.requester_name}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-1">Request Reason:</p>
              <p className="text-sm text-muted-foreground">{actionDialog?.request.reason}</p>
            </div>

            <div className="space-y-2">
              <Label>Reviewer Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about this decision..."
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              variant={actionDialog?.action === 'approve' ? 'default' : 'destructive'}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {actionDialog?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
