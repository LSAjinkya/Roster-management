-- Create departments table for dynamic department management
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  head_member_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Everyone can view departments
CREATE POLICY "Anyone can view departments"
ON public.departments
FOR SELECT
USING (true);

-- Only HR and Admin can manage departments
CREATE POLICY "HR and Admins can manage departments"
ON public.departments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert existing departments from the types
INSERT INTO public.departments (name) VALUES
  ('Support'),
  ('Monitoring'),
  ('CloudPe'),
  ('Network'),
  ('AW'),
  ('Infra'),
  ('Vendor Coordinator'),
  ('HR'),
  ('Sales'),
  ('Admin'),
  ('Marketing'),
  ('Billing'),
  ('CO'),
  ('Development')
ON CONFLICT (name) DO NOTHING;