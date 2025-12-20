
-- Create shift_history table to track all roster changes
CREATE TABLE public.shift_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id TEXT NOT NULL,
  date DATE NOT NULL,
  old_shift_type TEXT,
  new_shift_type TEXT,
  action TEXT NOT NULL DEFAULT 'update', -- 'create', 'update', 'delete', 'swap'
  changed_by UUID REFERENCES auth.users(id),
  swap_with_member_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create swap_requests table for approval workflow
CREATE TABLE public.swap_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  date DATE NOT NULL,
  requester_shift TEXT NOT NULL,
  target_shift TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shift_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

-- Shift history policies
CREATE POLICY "Anyone can view shift history"
ON public.shift_history FOR SELECT
USING (true);

CREATE POLICY "TL HR Admin can insert shift history"
ON public.shift_history FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'tl')
);

-- Swap requests policies
CREATE POLICY "Users can view their own swap requests"
ON public.swap_requests FOR SELECT
USING (
  requester_id IN (SELECT id FROM team_members WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())) OR
  target_id IN (SELECT id FROM team_members WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())) OR
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'tl')
);

CREATE POLICY "Authenticated users can create swap requests"
ON public.swap_requests FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "TL HR Admin can update swap requests"
ON public.swap_requests FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'tl')
);

-- Trigger for updated_at
CREATE TRIGGER update_swap_requests_updated_at
BEFORE UPDATE ON public.swap_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
