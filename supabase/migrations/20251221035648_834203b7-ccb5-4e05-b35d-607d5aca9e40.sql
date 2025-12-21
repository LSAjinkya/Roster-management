-- Drop the public read policy for app_settings
DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;

-- The existing "Admins can manage app settings" policy with ALL command already covers SELECT for admins