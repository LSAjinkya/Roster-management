import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Calendar, Check, X, Clock, AlertCircle, Briefcase, Thermometer } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Progress } from '@/components/ui/progress';

type LeaveType = 'casual' | 'sick' | 'comp-off' | 'other';
type LeaveStatus = 'pending' | 'approved' | 'rejected';

interface LeaveRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  reason: string | null;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

interface LeaveBalance {
  id: string;
  user_id: string;
  year: number;
  casual_leave_total: number;
  casual_leave_used: number;
  sick_leave_total: number;
  sick_leave_used: number;
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  casual: 'Casual Leave',
  sick: 'Sick Leave',
  'comp-off': 'Compensatory Off',
  other: 'Other',
};

const STATUS_COLORS: Record<LeaveStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  approved: 'bg-green-500/20 text-green-700 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-700 border-red-500/30',
};

const STATUS_ICONS: Record<LeaveStatus, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  approved: <Check className="h-3 w-3" />,
  rejected: <X className="h-3 w-3" />,
};

export default function LeaveRequests() {
  const { user, canEditShifts, isHR, isTL, isAdmin } = useAuth();
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('casual');
  const [reason, setReason] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');

  useEffect(() => {
    fetchRequests();
    fetchLeaveBalance();
  }, [user]);

  const fetchLeaveBalance = async () => {
    if (!user) return;
    
    const currentYear = new Date().getFullYear();
    const { data, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', currentYear)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching leave balance:', error);
      return;
    }
    
    if (data) {
      setLeaveBalance(data as LeaveBalance);
    } else {
      // Set default balance if no record exists
      setLeaveBalance({
        id: '',
        user_id: user.id,
        year: currentYear,
        casual_leave_total: 12,
        casual_leave_used: 0,
        sick_leave_total: 10,
        sick_leave_used: 0,
      });
    }
  };

  const fetchRequests = async () => {
    if (!user) return;

    try {
      // Fetch my requests
      const { data: myData, error: myError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (myError) throw myError;
      setMyRequests((myData || []) as LeaveRequest[]);

      // If user can review, fetch all pending requests
      if (canEditShifts) {
        const { data: allData, error: allError } = await supabase
          .from('leave_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (allError) throw allError;

        // Get user names for all requests
        const userIds = [...new Set((allData || []).map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);

        const profileMap = new Map((profiles || []).map(p => [p.user_id, { name: p.full_name, email: p.email }]));

        const requestsWithNames = (allData || []).map(r => ({
          ...r,
          user_name: profileMap.get(r.user_id)?.name || 'Unknown',
          user_email: profileMap.get(r.user_id)?.email || '',
        })) as LeaveRequest[];

        setAllRequests(requestsWithNames);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: user?.id,
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          reason: reason || null,
        });

      if (error) throw error;

      toast.success('Leave request submitted successfully');
      setCreateDialogOpen(false);
      resetForm();
      fetchRequests();
      fetchLeaveBalance();
    } catch (error) {
      console.error('Error creating leave request:', error);
      toast.error('Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewRequest = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: reviewerNotes || null,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Update user status if approved
      if (status === 'approved') {
        const today = new Date().toISOString().split('T')[0];
        if (selectedRequest.start_date <= today && selectedRequest.end_date >= today) {
          await supabase
            .from('profiles')
            .update({ status: 'on-leave' })
            .eq('user_id', selectedRequest.user_id);
        }
      }

      toast.success(`Leave request ${status}`);
      setReviewDialogOpen(false);
      setSelectedRequest(null);
      setReviewerNotes('');
      fetchRequests();
      fetchLeaveBalance();
    } catch (error) {
      console.error('Error reviewing leave request:', error);
      toast.error('Failed to update leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Leave request cancelled');
      fetchRequests();
    } catch (error) {
      console.error('Error cancelling leave request:', error);
      toast.error('Failed to cancel leave request');
    }
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setLeaveType('casual');
    setReason('');
  };

  const openReviewDialog = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setReviewerNotes('');
    setReviewDialogOpen(true);
  };

  const getDaysCount = (start: string, end: string) => {
    return differenceInDays(new Date(end), new Date(start)) + 1;
  };

  const pendingCount = allRequests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Leave Requests" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader 
        title="Leave Requests" 
        subtitle="Request time off and manage leave approvals" 
      />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Leave Balance Cards */}
        {leaveBalance && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-blue-500" />
                  Casual Leave
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-medium">
                      {leaveBalance.casual_leave_used} / {leaveBalance.casual_leave_total} days
                    </span>
                  </div>
                  <Progress 
                    value={(leaveBalance.casual_leave_used / leaveBalance.casual_leave_total) * 100} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {leaveBalance.casual_leave_total - leaveBalance.casual_leave_used} days remaining
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-orange-500" />
                  Sick Leave
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-medium">
                      {leaveBalance.sick_leave_used} / {leaveBalance.sick_leave_total} days
                    </span>
                  </div>
                  <Progress 
                    value={(leaveBalance.sick_leave_used / leaveBalance.sick_leave_total) * 100} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {leaveBalance.sick_leave_total - leaveBalance.sick_leave_used} days remaining
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Request Leave
          </Button>
        </div>

        <Tabs defaultValue="my-requests">
          <TabsList>
            <TabsTrigger value="my-requests">My Requests</TabsTrigger>
            {canEditShifts && (
              <TabsTrigger value="all-requests" className="relative">
                All Requests
                {pendingCount > 0 && (
                  <span className="ml-2 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my-requests" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  My Leave Requests
                </CardTitle>
                <CardDescription>
                  Your submitted leave requests and their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {myRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No leave requests yet</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setCreateDialogOpen(true)}
                    >
                      Request Leave
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dates</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            {format(new Date(request.start_date), 'MMM d')} - {format(new Date(request.end_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>{getDaysCount(request.start_date, request.end_date)}</TableCell>
                          <TableCell>{LEAVE_TYPE_LABELS[request.leave_type]}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {request.reason || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${STATUS_COLORS[request.status]} flex items-center gap-1 w-fit`}>
                              {STATUS_ICONS[request.status]}
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {request.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelRequest(request.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                Cancel
                              </Button>
                            )}
                            {request.reviewer_notes && (
                              <span className="text-xs text-muted-foreground ml-2">
                                Note: {request.reviewer_notes}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {canEditShifts && (
            <TabsContent value="all-requests" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    All Leave Requests
                  </CardTitle>
                  <CardDescription>
                    Review and approve/reject leave requests from team members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {allRequests.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No leave requests</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{request.user_name}</p>
                                <p className="text-xs text-muted-foreground">{request.user_email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(request.start_date), 'MMM d')} - {format(new Date(request.end_date), 'MMM d')}
                            </TableCell>
                            <TableCell>{getDaysCount(request.start_date, request.end_date)}</TableCell>
                            <TableCell>{LEAVE_TYPE_LABELS[request.leave_type]}</TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {request.reason || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${STATUS_COLORS[request.status]} flex items-center gap-1 w-fit`}>
                                {STATUS_ICONS[request.status]}
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {request.status === 'pending' && request.user_id !== user?.id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openReviewDialog(request)}
                                >
                                  Review
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Create Leave Request Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>
              Submit a leave request for approval
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for leave..."
                rows={3}
              />
            </div>
            {startDate && endDate && (
              <p className="text-sm text-muted-foreground">
                Total days: {getDaysCount(startDate, endDate)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRequest} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Leave Request Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Leave Request</DialogTitle>
            <DialogDescription>
              Approve or reject this leave request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p><strong>Employee:</strong> {selectedRequest.user_name}</p>
                <p><strong>Dates:</strong> {format(new Date(selectedRequest.start_date), 'MMM d, yyyy')} - {format(new Date(selectedRequest.end_date), 'MMM d, yyyy')}</p>
                <p><strong>Days:</strong> {getDaysCount(selectedRequest.start_date, selectedRequest.end_date)}</p>
                <p><strong>Type:</strong> {LEAVE_TYPE_LABELS[selectedRequest.leave_type]}</p>
                {selectedRequest.reason && <p><strong>Reason:</strong> {selectedRequest.reason}</p>}
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder="Add notes for the employee..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleReviewRequest('rejected')}
              disabled={submitting}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button 
              onClick={() => handleReviewRequest('approved')}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
