-- Update RLS policies to include roster_manager role for roster-related operations

-- Update shift_assignments policies to include roster_manager
DROP POLICY IF EXISTS "HR and TLs can delete shift assignments" ON public.shift_assignments;
DROP POLICY IF EXISTS "HR and TLs can insert shift assignments" ON public.shift_assignments;
DROP POLICY IF EXISTS "HR and TLs can update shift assignments" ON public.shift_assignments;

CREATE POLICY "HR TL and Roster Managers can delete shift assignments" 
ON public.shift_assignments 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role) OR
  has_role(auth.uid(), 'roster_manager'::app_role)
);

CREATE POLICY "HR TL and Roster Managers can insert shift assignments" 
ON public.shift_assignments 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role) OR
  has_role(auth.uid(), 'roster_manager'::app_role)
);

CREATE POLICY "HR TL and Roster Managers can update shift assignments" 
ON public.shift_assignments 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role) OR
  has_role(auth.uid(), 'roster_manager'::app_role)
);

-- Update shift_history policies
DROP POLICY IF EXISTS "TL HR Admin can insert shift history" ON public.shift_history;
CREATE POLICY "TL HR Admin RosterManager can insert shift history" 
ON public.shift_history 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role) OR
  has_role(auth.uid(), 'roster_manager'::app_role)
);

-- Update roster_versions policies
DROP POLICY IF EXISTS "TL HR Admin can delete roster versions" ON public.roster_versions;
DROP POLICY IF EXISTS "TL HR Admin can insert roster versions" ON public.roster_versions;

CREATE POLICY "TL HR Admin RosterManager can delete roster versions" 
ON public.roster_versions 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role) OR
  has_role(auth.uid(), 'roster_manager'::app_role)
);

CREATE POLICY "TL HR Admin RosterManager can insert roster versions" 
ON public.roster_versions 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role) OR
  has_role(auth.uid(), 'roster_manager'::app_role)
);

-- Update member_rotation_state policies
DROP POLICY IF EXISTS "HR Admin TL can manage rotation state" ON public.member_rotation_state;
CREATE POLICY "HR Admin TL RosterManager can manage rotation state" 
ON public.member_rotation_state 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role) OR
  has_role(auth.uid(), 'roster_manager'::app_role)
);

-- Update dc_staff_transfers policies
DROP POLICY IF EXISTS "HR Admin TL can manage DC transfers" ON public.dc_staff_transfers;
CREATE POLICY "HR Admin TL RosterManager can manage DC transfers" 
ON public.dc_staff_transfers 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role) OR
  has_role(auth.uid(), 'roster_manager'::app_role)
);

-- Update swap_requests policies
DROP POLICY IF EXISTS "TL HR Admin can update swap requests" ON public.swap_requests;
CREATE POLICY "TL HR Admin RosterManager can update swap requests" 
ON public.swap_requests 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR 
  has_role(auth.uid(), 'tl'::app_role) OR
  has_role(auth.uid(), 'roster_manager'::app_role)
);