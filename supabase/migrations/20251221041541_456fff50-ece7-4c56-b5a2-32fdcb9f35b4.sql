-- Add is_active column to profiles table for access control
ALTER TABLE public.profiles 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.is_active IS 'Controls whether user can access the roster management system';

-- Allow HR and Admin to update the is_active field
CREATE POLICY "HR and Admin can update user access" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));