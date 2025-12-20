-- Create leave_balances table to track remaining leave days per user
CREATE TABLE public.leave_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  casual_leave_total INTEGER NOT NULL DEFAULT 12,
  casual_leave_used INTEGER NOT NULL DEFAULT 0,
  sick_leave_total INTEGER NOT NULL DEFAULT 10,
  sick_leave_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

-- Enable RLS
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- Users can view their own leave balance
CREATE POLICY "Users can view their own leave balance"
ON public.leave_balances
FOR SELECT
USING (auth.uid() = user_id);

-- HR and Admin can view all leave balances
CREATE POLICY "HR and Admin can view all leave balances"
ON public.leave_balances
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr')
  )
);

-- HR and Admin can insert leave balances
CREATE POLICY "HR and Admin can insert leave balances"
ON public.leave_balances
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr')
  )
);

-- HR and Admin can update leave balances
CREATE POLICY "HR and Admin can update leave balances"
ON public.leave_balances
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_leave_balances_updated_at
BEFORE UPDATE ON public.leave_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-update leave balance when leave request is approved
CREATE OR REPLACE FUNCTION public.update_leave_balance_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  leave_days INTEGER;
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Calculate number of leave days
    leave_days := (NEW.end_date::date - NEW.start_date::date) + 1;
    
    -- Create balance record if doesn't exist
    INSERT INTO public.leave_balances (user_id, year)
    VALUES (NEW.user_id, EXTRACT(YEAR FROM NEW.start_date)::INTEGER)
    ON CONFLICT (user_id, year) DO NOTHING;
    
    -- Update the appropriate leave type
    IF NEW.leave_type = 'casual' THEN
      UPDATE public.leave_balances
      SET casual_leave_used = casual_leave_used + leave_days,
          updated_at = now()
      WHERE user_id = NEW.user_id
      AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER;
    ELSIF NEW.leave_type = 'sick' THEN
      UPDATE public.leave_balances
      SET sick_leave_used = sick_leave_used + leave_days,
          updated_at = now()
      WHERE user_id = NEW.user_id
      AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on leave_requests
CREATE TRIGGER on_leave_request_approved
AFTER UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_leave_balance_on_approval();