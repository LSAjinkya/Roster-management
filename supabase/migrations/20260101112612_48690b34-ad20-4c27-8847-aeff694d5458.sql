
-- Add status column to shift_assignments for draft/published workflow
ALTER TABLE public.shift_assignments 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- Add index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_shift_assignments_status ON public.shift_assignments(status);

-- Update existing assignments to published status
UPDATE public.shift_assignments SET status = 'published' WHERE status = 'draft';
