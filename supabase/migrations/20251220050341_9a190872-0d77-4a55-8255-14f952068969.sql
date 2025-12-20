-- Update the handle_new_user function to assign admin role to Ajinkya Lawand
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
$$;