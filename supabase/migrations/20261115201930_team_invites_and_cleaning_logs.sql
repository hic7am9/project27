/*
# Team Invites & Cleaning Logs

## Overview
1. Adds a `team_invites` table for one-time invite links with 7-day expiry.
   The owner generates a link with a token, copies it manually, and sends it to the invitee.
   When the invitee opens the link and signs up, the invite is consumed (single-use)
   and they are linked to the team with the specified role.
2. Adds a `cleaning_logs` table that records every cleaning action.
   The `mark_apartment_clean` function is updated to insert a log row on each successful clean.
3. Adds a `consume_invite` SECURITY DEFINER function that validates the token,
   checks it's not expired or already used, and creates a team_members row.

## New Tables

### team_invites
- id (uuid PK)
- owner_id (uuid FK -> profiles.id, the team owner who created the invite)
- email (text, the email the invite is intended for)
- role (text: 'host' | 'cleaner')
- token (text, unique, the one-time invite token)
- status (text: 'pending' | 'used' | 'expired')
- expires_at (timestamptz, 7 days from creation)
- created_at (timestamptz)
- used_at (timestamptz, nullable, set when consumed)

### cleaning_logs
- id (uuid PK)
- apartment_id (uuid FK -> apartments.id)
- cleaner_user_id (uuid FK -> profiles.id)
- owner_id (uuid FK -> profiles.id, the team owner)
- cleaned_at (timestamptz, when the cleaning happened)

## Modified Functions
- `mark_apartment_clean(p_apartment_id)`: now inserts a row into cleaning_logs on success.
- New `consume_invite(p_token, p_user_id, p_email)`: validates and consumes an invite.

## Security
- RLS enabled on both new tables.
- team_invites: owner can CRUD their own invites; anyone with a valid token can read (to check validity via RPC).
- cleaning_logs: owner + host can read; cleaners cannot read (no direct grant); inserts only via the SECURITY DEFINER function.
- All existing RLS policies preserved unchanged.
*/

-- ============ team_invites table ============
CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('host', 'cleaner')),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO service_role;

CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_owner ON public.team_invites(owner_id);

-- Owner can manage their own invites
DROP POLICY IF EXISTS "select_own_team_invites" ON public.team_invites;
CREATE POLICY "select_own_team_invites" ON public.team_invites FOR SELECT
  TO authenticated USING (owner_id = public.get_my_owner_id());

DROP POLICY IF EXISTS "insert_own_team_invites" ON public.team_invites;
CREATE POLICY "insert_own_team_invites" ON public.team_invites FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "update_own_team_invites" ON public.team_invites;
CREATE POLICY "update_own_team_invites" ON public.team_invites FOR UPDATE
  TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_team_invites" ON public.team_invites;
CREATE POLICY "delete_own_team_invites" ON public.team_invites FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- ============ cleaning_logs table ============
CREATE TABLE IF NOT EXISTS public.cleaning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  cleaner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cleaned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cleaning_logs ENABLE ROW LEVEL SECURITY;

-- Only owner + host can read cleaning logs (cleaners cannot)
GRANT SELECT ON public.cleaning_logs TO authenticated;
GRANT SELECT, INSERT ON public.cleaning_logs TO service_role;

CREATE INDEX IF NOT EXISTS idx_cleaning_logs_apartment ON public.cleaning_logs(apartment_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_cleaner ON public.cleaning_logs(cleaner_user_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_owner ON public.cleaning_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_cleaned_at ON public.cleaning_logs(cleaned_at);

DROP POLICY IF EXISTS "select_own_cleaning_logs" ON public.cleaning_logs;
CREATE POLICY "select_own_cleaning_logs" ON public.cleaning_logs FOR SELECT
  TO authenticated USING (owner_id = public.get_my_owner_id() AND public.get_my_role() IN ('owner', 'host'));

-- No INSERT/UPDATE/DELETE policies — only the SECURITY DEFINER function inserts

-- ============ consume_invite function ============
CREATE OR REPLACE FUNCTION public.consume_invite(p_token text, p_user_id uuid, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.team_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM public.team_invites WHERE token = p_token FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid invite token');
  END IF;

  IF v_invite.status = 'used' THEN
    RETURN json_build_object('success', false, 'error', 'This invite link has already been used');
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.team_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN json_build_object('success', false, 'error', 'This invite link has expired');
  END IF;

  -- Email must match the invite email
  IF lower(v_invite.email) != lower(p_email) THEN
    RETURN json_build_object('success', false, 'error', 'This invite is for a different email address');
  END IF;

  -- Check if already a team member
  IF EXISTS (SELECT 1 FROM public.team_members WHERE owner_id = v_invite.owner_id AND member_user_id = p_user_id) THEN
    UPDATE public.team_invites SET status = 'used', used_at = now() WHERE id = v_invite.id;
    RETURN json_build_object('success', true, 'message', 'Already a team member');
  END IF;

  -- Insert team_members row
  INSERT INTO public.team_members (owner_id, member_user_id, role, email)
  VALUES (v_invite.owner_id, p_user_id, v_invite.role, lower(p_email));

  -- Mark invite as used
  UPDATE public.team_invites SET status = 'used', used_at = now() WHERE id = v_invite.id;

  RETURN json_build_object('success', true, 'role', v_invite.role);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_invite(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_invite(text, uuid, text) TO authenticated;

-- ============ Update mark_apartment_clean to log ============
CREATE OR REPLACE FUNCTION public.mark_apartment_clean(p_apartment_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_is_assigned boolean;
  v_current_status text;
  v_owner_id uuid;
BEGIN
  SELECT public.get_my_role() INTO v_role;
  IF v_role != 'cleaner' THEN
    RETURN json_build_object('success', false, 'error', 'Only cleaners can mark apartments clean');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.cleaner_apartments
    WHERE cleaner_user_id = auth.uid() AND apartment_id = p_apartment_id
  ) INTO v_is_assigned;

  IF NOT v_is_assigned THEN
    RETURN json_build_object('success', false, 'error', 'Apartment not assigned to you');
  END IF;

  SELECT status, user_id INTO v_current_status, v_owner_id FROM public.apartments WHERE id = p_apartment_id;
  IF v_current_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Apartment not found');
  END IF;

  IF v_current_status != 'needs_cleaning' THEN
    RETURN json_build_object('success', false, 'error', 'Apartment does not need cleaning');
  END IF;

  UPDATE public.apartments SET status = 'ready' WHERE id = p_apartment_id;

  -- Log the cleaning
  INSERT INTO public.cleaning_logs (apartment_id, cleaner_user_id, owner_id)
  VALUES (p_apartment_id, auth.uid(), v_owner_id);

  RETURN json_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_apartment_clean(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_apartment_clean(uuid) TO authenticated;
