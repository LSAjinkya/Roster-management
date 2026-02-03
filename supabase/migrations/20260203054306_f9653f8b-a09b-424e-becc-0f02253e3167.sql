-- Create a table to store roster version snapshots
CREATE TABLE public.roster_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_name TEXT,
  change_type TEXT NOT NULL DEFAULT 'manual',
  description TEXT,
  assignments_snapshot JSONB NOT NULL,
  snapshot_date_from DATE NOT NULL,
  snapshot_date_to DATE NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.roster_versions IS 'Stores snapshots of shift assignments for version history and rollback capability';

-- Enable RLS
ALTER TABLE public.roster_versions ENABLE ROW LEVEL SECURITY;

-- Anyone can view roster versions
CREATE POLICY "Anyone can view roster versions"
ON public.roster_versions
FOR SELECT
USING (true);

-- TL, HR, Admin can create versions
CREATE POLICY "TL HR Admin can insert roster versions"
ON public.roster_versions
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role)
);

-- TL, HR, Admin can delete versions
CREATE POLICY "TL HR Admin can delete roster versions"
ON public.roster_versions
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role)
);

-- Create index for faster queries
CREATE INDEX idx_roster_versions_created_at ON public.roster_versions(created_at DESC);
CREATE INDEX idx_roster_versions_date_range ON public.roster_versions(snapshot_date_from, snapshot_date_to);