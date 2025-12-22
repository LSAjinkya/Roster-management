-- Create permission_requests table for elevated permission workflow
CREATE TABLE public.permission_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('admin', 'hr', 'tl')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.permission_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own permission requests"
ON public.permission_requests
FOR SELECT
USING (auth.uid() = requester_id);

-- Admin/HR can view all requests
CREATE POLICY "Admin HR can view all permission requests"
ON public.permission_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

-- Authenticated users can create requests
CREATE POLICY "Users can create permission requests"
ON public.permission_requests
FOR INSERT
WITH CHECK (auth.uid() = requester_id);

-- Admin/HR can update requests
CREATE POLICY "Admin HR can update permission requests"
ON public.permission_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_permission_requests_updated_at
BEFORE UPDATE ON public.permission_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();