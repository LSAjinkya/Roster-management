-- Add department-level roster configuration
ALTER TABLE public.departments
ADD COLUMN IF NOT EXISTS work_days_per_cycle integer NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS off_days_per_cycle integer NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS rotation_enabled boolean NOT NULL DEFAULT true;

-- Add comments for clarity
COMMENT ON COLUMN public.departments.work_days_per_cycle IS 'Number of work days before week-off in this department';
COMMENT ON COLUMN public.departments.off_days_per_cycle IS 'Number of consecutive week-off days in this department';
COMMENT ON COLUMN public.departments.rotation_enabled IS 'Whether this department uses shift rotation';