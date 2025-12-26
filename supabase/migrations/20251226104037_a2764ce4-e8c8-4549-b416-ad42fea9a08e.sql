-- Add week_off_entitlement column to team_members table
-- Values: 1 or 2 (OFF days per cycle)
ALTER TABLE public.team_members 
ADD COLUMN week_off_entitlement integer NOT NULL DEFAULT 2 
CHECK (week_off_entitlement IN (1, 2));