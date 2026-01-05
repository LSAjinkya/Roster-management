-- Add per-department week-off pattern override columns to departments table
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS week_off_pattern TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fixed_off_days TEXT[] DEFAULT NULL;

-- week_off_pattern can be: 'fixed', 'staggered', or NULL (use global setting)
-- fixed_off_days stores which days are off when week_off_pattern = 'fixed'

COMMENT ON COLUMN public.departments.week_off_pattern IS 'Override week-off pattern: fixed, staggered, or NULL to use global setting';
COMMENT ON COLUMN public.departments.fixed_off_days IS 'Array of day names (e.g., Saturday, Sunday) for fixed pattern';