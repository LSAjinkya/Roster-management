-- Add 'roster_manager' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'roster_manager';

-- Update the handle_new_user function to handle the new role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  
  -- Assign admin role to Ajinkya Lawand (super admin)
  IF NEW.email = 'ajinkya.lawand@leapswitch.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Default role is 'member'
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'member');
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update the has_role function to work with new role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;