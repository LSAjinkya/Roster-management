-- Create leave_requests table
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'casual' CHECK (leave_type IN ('casual', 'sick', 'comp-off', 'other')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own leave requests"
ON public.leave_requests
FOR SELECT
USING (auth.uid() = user_id);

-- TLs, HR, and Admins can view all requests
CREATE POLICY "TLs HR Admins can view all leave requests"
ON public.leave_requests
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'hr') 
  OR public.has_role(auth.uid(), 'tl')
);

-- Users can create their own requests
CREATE POLICY "Users can create own leave requests"
ON public.leave_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending requests
CREATE POLICY "Users can update own pending requests"
ON public.leave_requests
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- TLs, HR, and Admins can update any request (for approval)
CREATE POLICY "TLs HR Admins can update leave requests"
ON public.leave_requests
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'hr') 
  OR public.has_role(auth.uid(), 'tl')
);

-- Users can delete their own pending requests
CREATE POLICY "Users can delete own pending requests"
ON public.leave_requests
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Create indexes
CREATE INDEX idx_leave_requests_user ON public.leave_requests(user_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON public.leave_requests(start_date, end_date);

-- Add trigger for updated_at
CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();