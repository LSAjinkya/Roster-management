-- Create status history table
CREATE TABLE public.status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- Anyone can view status history
CREATE POLICY "Anyone can view status history"
ON public.status_history
FOR SELECT
USING (true);

-- Users can insert their own status changes, admins/HR can insert for anyone
CREATE POLICY "Users and admins can insert status history"
ON public.status_history
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'hr')
);

-- Create index for faster queries
CREATE INDEX idx_status_history_user ON public.status_history(user_id);
CREATE INDEX idx_status_history_changed_at ON public.status_history(changed_at DESC);

-- Create function to auto-log status changes
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.status_history (user_id, old_status, new_status, changed_by)
    VALUES (NEW.user_id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on profiles table
CREATE TRIGGER on_status_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_status_change();