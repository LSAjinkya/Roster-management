-- Create a security definer function to get allowed domains for authentication
-- This allows any authenticated or anonymous user to get the allowed domains for login validation
CREATE OR REPLACE FUNCTION public.get_allowed_google_domains()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  domains_value jsonb;
  result text[];
BEGIN
  SELECT value INTO domains_value
  FROM public.app_settings
  WHERE key = 'allowed_google_domains'
  LIMIT 1;
  
  IF domains_value IS NULL THEN
    RETURN ARRAY['leapswitch.com'];
  END IF;
  
  -- Parse the JSON array into a text array
  SELECT array_agg(elem::text)
  INTO result
  FROM jsonb_array_elements_text(domains_value) AS elem;
  
  RETURN COALESCE(result, ARRAY['leapswitch.com']);
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_allowed_google_domains() TO anon;
GRANT EXECUTE ON FUNCTION public.get_allowed_google_domains() TO authenticated;