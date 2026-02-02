-- Add column to store specific WFH days (0=Sunday, 1=Monday, ..., 6=Saturday)
ALTER TABLE public.team_members
ADD COLUMN hybrid_wfh_days_pattern integer[] DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.team_members.hybrid_wfh_days_pattern IS 'Array of weekday numbers (0=Sunday to 6=Saturday) for WFH days';