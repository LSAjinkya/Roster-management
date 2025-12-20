-- Allow all authenticated users to view approved leave requests
CREATE POLICY "Users can view approved leave requests"
ON public.leave_requests
FOR SELECT
USING (status = 'approved');