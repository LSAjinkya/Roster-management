import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember, ShiftType } from '@/types/roster';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Check, X, Clock, ArrowLeftRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SwapRequest {
  id: string;
  requester_id: string;
  target_id: string;
  date: string;
  requester_shift: string;
  target_shift: string;
  status: string;
  reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
}

interface SwapRequestsManagerProps {
  teamMembers: TeamMember[];
  onApproved?: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock size={14} />,
  approved: <Check size={14} />,
  rejected: <X size={14} />,
};

const shiftLabels: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
  general: 'General',
  leave: 'Leave',
  'comp-off': 'Week Off',
};

export function SwapRequestsManager({ teamMembers, onApproved }: SwapRequestsManagerProps) {
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SwapRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  
  const { canEditShifts } = useAuth();

  useEffect(() => {
    fetchRequests();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('swap-requests-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'swap_requests' },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('swap_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching swap requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMemberName = (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    return member?.name || memberId;
  };

  const handleReview = (request: SwapRequest) => {
    setSelectedRequest(request);
    setReviewNotes('');
    setReviewDialogOpen(true);
  };

  const processRequest = async (approved: boolean) => {
    if (!selectedRequest) return;
    
    setProcessing(selectedRequest.id);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update request status
      const { error: updateError } = await supabase
        .from('swap_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: reviewNotes || null,
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // If approved, perform the actual swap
      if (approved) {
        // Update requester's shift
        const { error: error1 } = await supabase
          .from('shift_assignments')
          .update({ shift_type: selectedRequest.target_shift })
          .eq('member_id', selectedRequest.requester_id)
          .eq('date', selectedRequest.date);

        if (error1) throw error1;

        // Update target's shift
        const { error: error2 } = await supabase
          .from('shift_assignments')
          .update({ shift_type: selectedRequest.requester_shift })
          .eq('member_id', selectedRequest.target_id)
          .eq('date', selectedRequest.date);

        if (error2) throw error2;

        // Log the swap in history
        await supabase.from('shift_history').insert({
          member_id: selectedRequest.requester_id,
          date: selectedRequest.date,
          old_shift_type: selectedRequest.requester_shift,
          new_shift_type: selectedRequest.target_shift,
          action: 'swap',
          changed_by: user?.id,
          swap_with_member_id: selectedRequest.target_id,
          notes: `Swap request approved${reviewNotes ? `: ${reviewNotes}` : ''}`,
        });

        onApproved?.();
      }

      toast.success(approved ? 'Swap request approved' : 'Swap request rejected');
      setReviewDialogOpen(false);
      fetchRequests();
    } catch (error) {
      console.error('Error processing swap request:', error);
      toast.error('Failed to process request');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-muted-foreground">Loading requests...</div>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Clock size={16} className="text-yellow-600" />
          Pending Requests ({pendingRequests.length})
        </h3>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
            No pending swap requests
          </p>
        ) : (
          <div className="space-y-2">
            {pendingRequests.map((request) => (
              <div 
                key={request.id} 
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getMemberName(request.requester_id)}</span>
                    <Badge variant="outline" className="text-xs">
                      {shiftLabels[request.requester_shift] || request.requester_shift}
                    </Badge>
                    <ArrowLeftRight size={14} className="text-muted-foreground" />
                    <span className="font-medium">{getMemberName(request.target_id)}</span>
                    <Badge variant="outline" className="text-xs">
                      {shiftLabels[request.target_shift] || request.target_shift}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {format(new Date(request.date), 'EEEE, MMMM d, yyyy')}
                    {request.reason && <span className="italic"> — {request.reason}</span>}
                  </div>
                </div>
                {canEditShifts && (
                  <Button size="sm" onClick={() => handleReview(request)}>
                    Review
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">Recent Decisions</h3>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {processedRequests.slice(0, 20).map((request) => (
                <div 
                  key={request.id} 
                  className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30"
                >
                  <Badge className={cn("text-xs", statusColors[request.status])}>
                    {statusIcons[request.status]}
                    <span className="ml-1 capitalize">{request.status}</span>
                  </Badge>
                  <div className="flex-1 text-sm">
                    <span>{getMemberName(request.requester_id)}</span>
                    <ArrowLeftRight size={12} className="inline mx-1 text-muted-foreground" />
                    <span>{getMemberName(request.target_id)}</span>
                    <span className="text-muted-foreground ml-2">
                      {format(new Date(request.date), 'MMM d')}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(request.created_at), 'MMM d')}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Swap Request</DialogTitle>
            <DialogDescription>
              Approve or reject this shift swap request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-center flex-1">
                    <p className="font-medium">{getMemberName(selectedRequest.requester_id)}</p>
                    <Badge className="mt-1">{shiftLabels[selectedRequest.requester_shift]}</Badge>
                  </div>
                  <ArrowLeftRight className="text-muted-foreground mx-4" />
                  <div className="text-center flex-1">
                    <p className="font-medium">{getMemberName(selectedRequest.target_id)}</p>
                    <Badge className="mt-1">{shiftLabels[selectedRequest.target_shift]}</Badge>
                  </div>
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  {format(new Date(selectedRequest.date), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>

              {selectedRequest.reason && (
                <div>
                  <p className="text-sm font-medium mb-1">Reason:</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.reason}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Notes (optional):</p>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about your decision..."
                  rows={2}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button 
                  variant="destructive" 
                  onClick={() => processRequest(false)}
                  disabled={processing === selectedRequest.id}
                >
                  {processing === selectedRequest.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Reject
                </Button>
                <Button 
                  onClick={() => processRequest(true)}
                  disabled={processing === selectedRequest.id}
                >
                  {processing === selectedRequest.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
