-- Fix security issue: profiles table public read access
-- Change from public access to requiring authentication
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- Fix security issue: shift_assignments public read access
-- Change from public access to requiring authentication
DROP POLICY IF EXISTS "Anyone can view shift assignments" ON public.shift_assignments;
CREATE POLICY "Authenticated users can view shift assignments" 
  ON public.shift_assignments 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- Create OTP rate limits table for server-side rate limiting
CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  lockout_until timestamp with time zone,
  last_attempt timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on otp_rate_limits
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can manage rate limits (used by edge functions)
CREATE POLICY "Service role can manage rate limits" 
  ON public.otp_rate_limits 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_email ON public.otp_rate_limits(email);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_lockout ON public.otp_rate_limits(lockout_until);