/*
# Assign existing data to owner and set admin role

1. Sets the owner email to hic7am.skills@gmail.com.
   - If the owner has already signed up (exists in auth.users), their profile
     role is set to 'admin' and all existing NULL user_id rows across all
     tables are assigned to their user_id.
   - If the owner has NOT yet signed up, a placeholder admin role assignment
     is stored so that the handle_new_user trigger will set role='admin'
     when they do sign up.

2. The claim_existing_data() function already exists for claiming NULL rows
   after signup. This migration additionally ensures the owner's profile
   gets role='admin' automatically.

3. Approach: We create a function that the trigger checks — if the new user's
   email matches the owner email, set role to 'admin' instead of 'user'.
   This is done by updating handle_new_user() to check the email.
*/

-- Update handle_new_user to set admin role for the owner email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
BEGIN
  is_owner := (NEW.email = 'hic7am.skills@gmail.com');

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE WHEN is_owner THEN 'admin' ELSE 'user' END
  );

  -- If this is the owner, claim all existing NULL user_id rows
  IF is_owner THEN
    UPDATE locations SET user_id = NEW.id WHERE user_id IS NULL;
    UPDATE apartments SET user_id = NEW.id WHERE user_id IS NULL;
    UPDATE bookings SET user_id = NEW.id WHERE user_id IS NULL;
    UPDATE guests_archive SET user_id = NEW.id WHERE user_id IS NULL;
    UPDATE ical_sync SET user_id = NEW.id WHERE user_id IS NULL;
    UPDATE deleted_bookings SET user_id = NEW.id WHERE user_id IS NULL;
    UPDATE cleaners SET user_id = NEW.id WHERE user_id IS NULL;
    UPDATE cleaner_assignments SET user_id = NEW.id WHERE user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;

-- If the owner already exists in auth.users, update their profile and claim data now
DO $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT id INTO owner_id FROM auth.users WHERE email = 'hic7am.skills@gmail.com' LIMIT 1;
  IF owner_id IS NOT NULL THEN
    -- Set admin role
    UPDATE public.profiles SET role = 'admin' WHERE id = owner_id;

    -- Claim all existing NULL rows
    UPDATE locations SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE apartments SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE bookings SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE guests_archive SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE ical_sync SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE deleted_bookings SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE cleaners SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE cleaner_assignments SET user_id = owner_id WHERE user_id IS NULL;
  END IF;
END $$;
