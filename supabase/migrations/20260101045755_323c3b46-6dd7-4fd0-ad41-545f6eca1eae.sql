-- Add hybrid working columns to team_members table
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS hybrid_office_days integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS hybrid_wfh_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_hybrid boolean DEFAULT false;

-- Add location type to work_locations (office vs datacenter)
ALTER TABLE public.work_locations 
ADD COLUMN IF NOT EXISTS location_type text DEFAULT 'office',
ADD COLUMN IF NOT EXISTS city text;

-- Insert missing office locations
INSERT INTO public.work_locations (name, code, address, location_type, city, is_active)
VALUES 
  ('Nashik', 'NASHIK', 'Nashik Office', 'office', 'Nashik', true),
  ('Bangalore', 'BLR', 'Bangalore Office', 'office', 'Bangalore', true)
ON CONFLICT (code) DO NOTHING;

-- Update existing locations with city
UPDATE public.work_locations SET city = 'Pune', location_type = 'office' WHERE name = 'Pune';
UPDATE public.work_locations SET city = 'Mumbai', location_type = 'office' WHERE name = 'Wadala';

-- Insert DC locations
INSERT INTO public.work_locations (name, code, address, location_type, city, is_active, min_night_shift_count)
VALUES 
  ('Yotta DC Mumbai', 'YOTTA-MUM', 'Yotta Data Center, Mumbai', 'datacenter', 'Mumbai', true, 2),
  ('LnT DC Mumbai', 'LNT-MUM', 'L&T Data Center, Mumbai', 'datacenter', 'Mumbai', true, 2),
  ('Iron Mountain Mumbai', 'IM-MUM', 'Iron Mountain, Mumbai', 'datacenter', 'Mumbai', true, 2),
  ('Iron Mountain Pune', 'IM-PUNE', 'Iron Mountain, Pune', 'datacenter', 'Pune', true, 2),
  ('Iron Mountain Noida', 'IM-NOIDA', 'Iron Mountain, Noida', 'datacenter', 'Noida', true, 2),
  ('Yotta DC Noida', 'YOTTA-NOIDA', 'Yotta Data Center, Noida', 'datacenter', 'Noida', true, 2),
  ('WFH', 'WFH', 'Work From Home', 'remote', 'Remote', true, 0)
ON CONFLICT (code) DO NOTHING;