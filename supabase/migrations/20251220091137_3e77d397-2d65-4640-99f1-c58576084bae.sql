-- Create app settings table for configurable options like allowed domains
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view settings
CREATE POLICY "Anyone can view app settings"
ON public.app_settings FOR SELECT
USING (true);

-- Only admins can manage settings
CREATE POLICY "Admins can manage app settings"
ON public.app_settings FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default allowed domains setting
INSERT INTO public.app_settings (key, value, description)
VALUES ('allowed_google_domains', '["leapswitch.com"]', 'List of domains allowed to sign in with Google');

-- Create user 2FA settings table
CREATE TABLE public.user_2fa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  totp_enabled boolean NOT NULL DEFAULT false,
  totp_secret text,
  email_otp_enabled boolean NOT NULL DEFAULT false,
  backup_codes jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_2fa_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own 2FA settings
CREATE POLICY "Users can view own 2FA settings"
ON public.user_2fa_settings FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own 2FA settings
CREATE POLICY "Users can update own 2FA settings"
ON public.user_2fa_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Users can insert their own 2FA settings
CREATE POLICY "Users can insert own 2FA settings"
ON public.user_2fa_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all 2FA settings (for support)
CREATE POLICY "Admins can view all 2FA settings"
ON public.user_2fa_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_user_2fa_settings_updated_at
BEFORE UPDATE ON public.user_2fa_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for pending 2FA verifications
CREATE TABLE public.pending_2fa_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  otp_code text NOT NULL,
  method text NOT NULL CHECK (method IN ('totp', 'email')),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_2fa_verification ENABLE ROW LEVEL SECURITY;

-- Users can view their own pending verifications
CREATE POLICY "Users can view own pending 2FA"
ON public.pending_2fa_verification FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own pending verifications
CREATE POLICY "Users can insert own pending 2FA"
ON public.pending_2fa_verification FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own pending verifications
CREATE POLICY "Users can delete own pending 2FA"
ON public.pending_2fa_verification FOR DELETE
USING (auth.uid() = user_id);