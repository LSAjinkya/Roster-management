-- Create datacenters table for Infra team tracking
CREATE TABLE public.datacenters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.datacenters ENABLE ROW LEVEL SECURITY;

-- Anyone can view datacenters
CREATE POLICY "Anyone can view datacenters"
ON public.datacenters FOR SELECT
USING (true);

-- HR and Admins can manage datacenters
CREATE POLICY "HR and Admins can manage datacenters"
ON public.datacenters FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'));

-- Insert default datacenters
INSERT INTO public.datacenters (name, code) VALUES 
  ('LnT', 'LNT'),
  ('Yotta', 'YOTTA');

-- Add datacenter_id to team_members for Infra assignment
ALTER TABLE public.team_members 
ADD COLUMN datacenter_id uuid REFERENCES public.datacenters(id);

-- Create shift_composition_rules table
CREATE TABLE public.shift_composition_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_type text NOT NULL,
  department text NOT NULL,
  datacenter_id uuid REFERENCES public.datacenters(id), -- NULL means applies to all datacenters
  min_count integer NOT NULL DEFAULT 1,
  role_filter text[], -- NULL means all roles, otherwise only these roles
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(shift_type, department, datacenter_id)
);

-- Enable RLS
ALTER TABLE public.shift_composition_rules ENABLE ROW LEVEL SECURITY;

-- Anyone can view rules
CREATE POLICY "Anyone can view shift composition rules"
ON public.shift_composition_rules FOR SELECT
USING (true);

-- HR and Admins can manage rules
CREATE POLICY "HR and Admins can manage shift composition rules"
ON public.shift_composition_rules FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'));

-- Insert default composition rules per your requirements
-- Morning/Afternoon/Night: 2×L2 (Support), 1×Monitoring, 1×CloudPe, 2×Network, 1×AW, 2×Infra per datacenter
INSERT INTO public.shift_composition_rules (shift_type, department, min_count, role_filter) VALUES
  -- Support L2 for all shifts
  ('morning', 'Support', 2, ARRAY['L2']),
  ('afternoon', 'Support', 2, ARRAY['L2']),
  ('night', 'Support', 2, ARRAY['L2']),
  -- Monitoring
  ('morning', 'Monitoring', 1, NULL),
  ('afternoon', 'Monitoring', 1, NULL),
  ('night', 'Monitoring', 1, NULL),
  -- CloudPe
  ('morning', 'CloudPe', 1, NULL),
  ('afternoon', 'CloudPe', 1, NULL),
  ('night', 'CloudPe', 1, NULL),
  -- Network
  ('morning', 'Network', 2, NULL),
  ('afternoon', 'Network', 2, NULL),
  ('night', 'Network', 2, NULL),
  -- AW
  ('morning', 'AW', 1, NULL),
  ('afternoon', 'AW', 1, NULL),
  ('night', 'AW', 1, NULL);

-- Infra rules per datacenter
INSERT INTO public.shift_composition_rules (shift_type, department, datacenter_id, min_count)
SELECT 
  shift.type,
  'Infra',
  dc.id,
  2
FROM 
  (VALUES ('morning'), ('afternoon'), ('night')) AS shift(type),
  public.datacenters dc;

-- Create rotation_config table to store rotation settings
CREATE TABLE public.rotation_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rotation_cycle_days integer NOT NULL DEFAULT 15,
  max_consecutive_nights integer NOT NULL DEFAULT 5,
  min_rest_hours integer NOT NULL DEFAULT 12,
  work_days integer NOT NULL DEFAULT 5,
  off_days integer NOT NULL DEFAULT 2,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rotation_config ENABLE ROW LEVEL SECURITY;

-- Anyone can view config
CREATE POLICY "Anyone can view rotation config"
ON public.rotation_config FOR SELECT
USING (true);

-- HR and Admins can manage config
CREATE POLICY "HR and Admins can manage rotation config"
ON public.rotation_config FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr'));

-- Insert default config
INSERT INTO public.rotation_config (rotation_cycle_days, max_consecutive_nights, min_rest_hours, work_days, off_days)
VALUES (15, 5, 12, 5, 2);

-- Add trigger for updated_at
CREATE TRIGGER update_datacenters_updated_at
BEFORE UPDATE ON public.datacenters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shift_composition_rules_updated_at
BEFORE UPDATE ON public.shift_composition_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rotation_config_updated_at
BEFORE UPDATE ON public.rotation_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();