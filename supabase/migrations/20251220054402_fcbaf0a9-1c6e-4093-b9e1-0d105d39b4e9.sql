-- Create public_holidays table to store fixed holidays
CREATE TABLE public.public_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date, year)
);

-- Enable RLS
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

-- Everyone can view public holidays
CREATE POLICY "Anyone can view public holidays"
ON public.public_holidays
FOR SELECT
USING (true);

-- Only HR and Admin can manage holidays
CREATE POLICY "HR and Admin can insert holidays"
ON public.public_holidays
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr')
  )
);

CREATE POLICY "HR and Admin can update holidays"
ON public.public_holidays
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr')
  )
);

CREATE POLICY "HR and Admin can delete holidays"
ON public.public_holidays
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'hr')
  )
);