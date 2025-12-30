-- Create work_locations table
CREATE TABLE public.work_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  min_night_shift_count integer NOT NULL DEFAULT 2,
  work_from_home_if_below_min boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;

-- Anyone can view work locations
CREATE POLICY "Anyone can view work locations"
ON public.work_locations
FOR SELECT
USING (true);

-- HR and Admins can manage work locations
CREATE POLICY "HR and Admins can manage work locations"
ON public.work_locations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

-- Add default work location to team_members
ALTER TABLE public.team_members
ADD COLUMN work_location_id uuid REFERENCES public.work_locations(id);

-- Add temporary work location override to shift_assignments
ALTER TABLE public.shift_assignments
ADD COLUMN work_location_id uuid REFERENCES public.work_locations(id);

-- Add trigger for updated_at on work_locations
CREATE TRIGGER update_work_locations_updated_at
BEFORE UPDATE ON public.work_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();