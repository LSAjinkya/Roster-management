-- Add team column to team_members for Alpha/Gamma/Beta team grouping
ALTER TABLE public.team_members 
ADD COLUMN team text DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.team_members.team IS 'Team grouping (Alpha, Gamma, Beta) for synchronized shift rotation';

-- Create index for faster team-based queries
CREATE INDEX idx_team_members_team ON public.team_members(team);
CREATE INDEX idx_team_members_department_team ON public.team_members(department, team);