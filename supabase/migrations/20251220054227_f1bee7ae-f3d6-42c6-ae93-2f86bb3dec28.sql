-- Update default leave totals based on company policy
-- Paid leave: 1.7 days/month = ~20 days/year
-- Public holidays: 11 days/year

-- Update column defaults
ALTER TABLE public.leave_balances 
  ALTER COLUMN casual_leave_total SET DEFAULT 20,
  ALTER COLUMN sick_leave_total SET DEFAULT 10;

-- Add public holidays column
ALTER TABLE public.leave_balances 
  ADD COLUMN IF NOT EXISTS public_holidays_total INTEGER NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS public_holidays_used INTEGER NOT NULL DEFAULT 0;

-- Update the leave approval trigger to handle all leave types
CREATE OR REPLACE FUNCTION public.update_leave_balance_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  leave_days INTEGER;
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Calculate number of leave days
    leave_days := (NEW.end_date::date - NEW.start_date::date) + 1;
    
    -- Create balance record if doesn't exist
    INSERT INTO public.leave_balances (user_id, year, casual_leave_total, sick_leave_total, public_holidays_total)
    VALUES (NEW.user_id, EXTRACT(YEAR FROM NEW.start_date)::INTEGER, 20, 10, 11)
    ON CONFLICT (user_id, year) DO NOTHING;
    
    -- Update the appropriate leave type
    IF NEW.leave_type = 'casual' THEN
      UPDATE public.leave_balances
      SET casual_leave_used = casual_leave_used + leave_days,
          updated_at = now()
      WHERE user_id = NEW.user_id
      AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER;
    ELSIF NEW.leave_type = 'sick' THEN
      UPDATE public.leave_balances
      SET sick_leave_used = sick_leave_used + leave_days,
          updated_at = now()
      WHERE user_id = NEW.user_id
      AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;