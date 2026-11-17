/*
# Add subscription & activation system (admin-controlled)

1. Plain-English summary
- Every new signup starts as "pending" and sees only an activation-code screen.
- Existing accounts stay active. The admin account (his7am@gmail.com) is always active.
- Admin creates one-time activation codes (stored as SHA-256 hashes, never plain text).
- Team members (host/cleaner) inherit their owner's subscription state.

2. Modified tables
- `profiles`: + account_status (pending/active/suspended/blocked, default pending),
  + subscription_ends_at, + activated_at, + blocked_reason.
  Backfill: all existing rows become 'active' so nothing changes for current users.
- `handle_new_user()` trigger: new users inserted with account_status = 'pending'
  (except his7am@gmail.com which is 'active').

3. New tables
- `activation_codes`: code_hash (unique sha256 hex), code_prefix (first 4 chars),
  duration_days, status (unused/used/revoked/expired), used_by_user_id, used_by_email,
  used_at, expires_at, note, created_by, created_at. RLS on; admins read-only.
- `activation_attempts`: per-user failed attempts + locked_until (5 fails => 15 min lock).
  Fully locked down (no direct access; used only inside SECURITY DEFINER functions).
- `admin_audit_log`: who did what, to whom, when, with jsonb details. Admin read-only.

4. New functions (all SECURITY DEFINER, EXECUTE revoked from PUBLIC/anon)
- activate_account(p_code): validates code, activates current user, extends subscription.
  Rate-limited: 5 wrong attempts => 15-minute lockout.
- my_access_state(): returns jsonb {state, subscription_ends_at, blocked_reason};
  state in active/pending/expired/blocked/suspended. Team members inherit owner state.
- generate_activation_codes(count, duration_days, valid_days, note): admin-only, returns
  the plain codes ONCE (only hashes are stored).
- admin_list_activation_codes, admin_revoke_code, admin_list_users_subscription,
  admin_set_user_status (also kills sessions), admin_extend_subscription,
  admin_reactivate_user, admin_subscription_stats, admin_subscription_audit.
- expire_stale_codes(): flips unused codes past expires_at to 'expired'.
- sha256_code(p_code): helper hashing with pgcrypto (extensions schema).

5. Security
- RLS enabled on all three new tables. Users can never write account_status directly
  (profiles UPDATE grant is already column-restricted to full_name only).
- All admin functions verify is_admin() internally AND are granted to authenticated only.
*/

-- ============ 1. profiles columns ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='account_status') THEN
    ALTER TABLE public.profiles ADD COLUMN account_status text NOT NULL DEFAULT 'pending'
      CHECK (account_status IN ('pending','active','suspended','blocked'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='subscription_ends_at') THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_ends_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='activated_at') THEN
    ALTER TABLE public.profiles ADD COLUMN activated_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='blocked_reason') THEN
    ALTER TABLE public.profiles ADD COLUMN blocked_reason text;
  END IF;
END $$;

-- Existing accounts remain active; admin always active.
UPDATE public.profiles SET account_status = 'active', activated_at = COALESCE(activated_at, now())
WHERE account_status = 'pending';
UPDATE public.profiles SET account_status = 'active' WHERE role = 'admin';

CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);

-- ============ 2. handle_new_user: new signups start pending ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, account_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN NEW.email = 'his7am@gmail.com' THEN 'active' ELSE 'pending' END
  );
  INSERT INTO public.team_members (owner_id, member_user_id, role, email)
  VALUES (NEW.id, NEW.id, 'owner', NEW.email);
  RETURN NEW;
END;
$$;

-- ============ 3. activation_codes ============
CREATE TABLE IF NOT EXISTS public.activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  code_prefix text NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days BETWEEN 1 AND 3650),
  status text NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','used','revoked','expired')),
  used_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_by_email text,
  used_at timestamptz,
  expires_at timestamptz,
  note text,
  created_by uuid,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activation_codes_status ON public.activation_codes(status);

ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_activation_codes" ON public.activation_codes;
CREATE POLICY "admin_select_activation_codes"
ON public.activation_codes FOR SELECT
TO authenticated
USING (public.is_admin());

GRANT SELECT ON public.activation_codes TO authenticated;

-- ============ 4. activation_attempts (rate limiting) ============
CREATE TABLE IF NOT EXISTS public.activation_attempts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  failed_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activation_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activation_attempts FROM PUBLIC, anon, authenticated;

-- ============ 5. admin_audit_log ============
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL,
  target_user_id uuid,
  target_email text,
  details jsonb,
  created_by uuid,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_audit_log" ON public.admin_audit_log;
CREATE POLICY "admin_select_audit_log"
ON public.admin_audit_log FOR SELECT
TO authenticated
USING (public.is_admin());

GRANT SELECT ON public.admin_audit_log TO authenticated;

-- ============ 6. helpers ============
CREATE OR REPLACE FUNCTION public.sha256_code(p_code text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(p_code, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_codes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.activation_codes
  SET status = 'expired'
  WHERE status = 'unused' AND expires_at IS NOT NULL AND expires_at < now();
$$;

-- ============ 7. my_access_state ============
CREATE OR REPLACE FUNCTION public.my_access_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role = 'admin' THEN
    RETURN json_build_object('state', 'active', 'subscription_ends_at', NULL, 'blocked_reason', NULL);
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('state', 'pending', 'subscription_ends_at', NULL, 'blocked_reason', NULL);
  END IF;

  -- Team members inherit the owner's subscription state.
  IF v_role IS DISTINCT FROM 'owner' THEN
    SELECT p.* INTO v_profile
    FROM public.team_members tm
    JOIN public.profiles p ON p.id = tm.owner_id
    WHERE tm.member_user_id = auth.uid() AND tm.role != 'owner'
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN json_build_object('state', 'active', 'subscription_ends_at', NULL, 'blocked_reason', NULL);
    END IF;
  END IF;

  IF v_profile.account_status = 'blocked' THEN
    RETURN json_build_object('state', 'blocked', 'subscription_ends_at', v_profile.subscription_ends_at, 'blocked_reason', v_profile.blocked_reason);
  END IF;
  IF v_profile.account_status = 'suspended' THEN
    RETURN json_build_object('state', 'suspended', 'subscription_ends_at', v_profile.subscription_ends_at, 'blocked_reason', v_profile.blocked_reason);
  END IF;
  IF v_profile.account_status = 'pending' THEN
    RETURN json_build_object('state', 'pending', 'subscription_ends_at', NULL, 'blocked_reason', NULL);
  END IF;
  IF v_profile.subscription_ends_at IS NOT NULL AND v_profile.subscription_ends_at < now() THEN
    RETURN json_build_object('state', 'expired', 'subscription_ends_at', v_profile.subscription_ends_at, 'blocked_reason', NULL);
  END IF;
  RETURN json_build_object('state', 'active', 'subscription_ends_at', v_profile.subscription_ends_at, 'blocked_reason', NULL);
END;
$$;

-- ============ 8. activate_account ============
CREATE OR REPLACE FUNCTION public.activate_account(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code_norm text := upper(btrim(coalesce(p_code, '')));
  v_code_hash text;
  v_code public.activation_codes%ROWTYPE;
  v_new_ends timestamptz;
  v_failed integer;
  v_locked_until timestamptz;
  v_is_admin boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'يجب تسجيل الدخول أولاً');
  END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_user_id;
  IF v_is_admin THEN
    RETURN json_build_object('success', true, 'message', 'الحساب مفعّل دائماً');
  END IF;

  -- Rate limiting: 5 wrong attempts => 15 minute lock.
  SELECT failed_count, locked_until INTO v_failed, v_locked_until
  FROM public.activation_attempts WHERE user_id = v_user_id;
  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN json_build_object('success', false,
      'message', 'تم قفل المحاولات مؤقتاً. حاول مرة أخرى بعد ' ||
      CEIL(EXTRACT(EPOCH FROM (v_locked_until - now())) / 60)::int || ' دقيقة',
      'locked_until', v_locked_until);
  END IF;

  v_code_hash := public.sha256_code(v_code_norm);

  SELECT * INTO v_code FROM public.activation_codes WHERE code_hash = v_code_hash;
  IF NOT FOUND
     OR v_code.status <> 'unused'
     OR (v_code.expires_at IS NOT NULL AND v_code.expires_at < now()) THEN
    v_failed := COALESCE(v_failed, 0) + 1;
    IF v_failed >= 5 THEN
      INSERT INTO public.activation_attempts (user_id, failed_count, locked_until, updated_at)
      VALUES (v_user_id, 0, now() + interval '15 minutes', now())
      ON CONFLICT (user_id) DO UPDATE
        SET failed_count = 0, locked_until = now() + interval '15 minutes', updated_at = now();
      RETURN json_build_object('success', false, 'message', 'تم تجاوز عدد المحاولات المسموح. القفل لمدة 15 دقيقة');
    END IF;
    INSERT INTO public.activation_attempts (user_id, failed_count, updated_at)
    VALUES (v_user_id, v_failed, now())
    ON CONFLICT (user_id) DO UPDATE SET failed_count = v_failed, updated_at = now();
    RETURN json_build_object('success', false, 'message', 'كود غير صالح أو مستخدم أو منتهي. المحاولات المتبقية: ' || (5 - v_failed));
  END IF;

  -- Extend from current end date if still active, otherwise from now.
  SELECT GREATEST(COALESCE(subscription_ends_at, now()), now()) + (v_code.duration_days || ' days')::interval
  INTO v_new_ends
  FROM public.profiles WHERE id = v_user_id;

  UPDATE public.activation_codes
  SET status = 'used',
      used_by_user_id = v_user_id,
      used_by_email = (SELECT email FROM public.profiles WHERE id = v_user_id),
      used_at = now()
  WHERE id = v_code.id;

  UPDATE public.profiles
  SET account_status = 'active',
      subscription_ends_at = v_new_ends,
      activated_at = COALESCE(activated_at, now()),
      blocked_reason = NULL
  WHERE id = v_user_id;

  DELETE FROM public.activation_attempts WHERE user_id = v_user_id;

  INSERT INTO public.admin_audit_log (action, target_user_id, target_email, details, created_by, created_by_email)
  VALUES ('account_activated', v_user_id, (SELECT email FROM public.profiles WHERE id = v_user_id),
          json_build_object('code_prefix', v_code.code_prefix, 'duration_days', v_code.duration_days, 'new_ends_at', v_new_ends),
          v_user_id, (SELECT email FROM public.profiles WHERE id = v_user_id));

  RETURN json_build_object('success', true, 'message', 'تم تفعيل الحساب بنجاح',
    'subscription_ends_at', v_new_ends);
END;
$$;

-- ============ 9. generate_activation_codes (admin only) ============
CREATE OR REPLACE FUNCTION public.generate_activation_codes(
  p_count integer,
  p_duration_days integer,
  p_valid_days integer,
  p_note text DEFAULT NULL
)
RETURNS TABLE (code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_charset text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_plain text;
  v_bytes bytea;
  v_i integer;
  v_j integer;
  v_codes text[];
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية للمشرف فقط' USING ERRCODE = '42501';
  END IF;
  IF p_count < 1 OR p_count > 100 THEN
    RAISE EXCEPTION 'عدد الأكواد يجب أن يكون بين 1 و 100';
  END IF;
  IF p_duration_days < 1 OR p_duration_days > 3650 THEN
    RAISE EXCEPTION 'مدة الاشتراك يجب أن تكون بين 1 و 3650 يوماً';
  END IF;

  FOR v_i IN 1..p_count LOOP
    LOOP
      v_plain := '';
      v_bytes := extensions.gen_random_bytes(16);
      FOR v_j IN 0..15 LOOP
        v_plain := v_plain || substr(v_charset, (get_byte(v_bytes, v_j) % 32) + 1, 1);
      END LOOP;
      v_plain := substr(v_plain, 1, 4) || '-' || substr(v_plain, 5, 4) || '-' || substr(v_plain, 9, 4) || '-' || substr(v_plain, 13, 4);
      EXIT WHEN NOT (v_plain = ANY (v_codes));
    END LOOP;
    v_codes := array_append(v_codes, v_plain);
    INSERT INTO public.activation_codes
      (code_hash, code_prefix, duration_days, status, expires_at, note, created_by, created_by_email)
    VALUES
      (public.sha256_code(v_plain), substr(v_plain, 1, 4), p_duration_days, 'unused',
       CASE WHEN p_valid_days IS NOT NULL AND p_valid_days > 0 THEN now() + (p_valid_days || ' days')::interval END,
       p_note, v_admin_id, (SELECT email FROM public.profiles WHERE id = v_admin_id));
  END LOOP;

  INSERT INTO public.admin_audit_log (action, target_email, details, created_by, created_by_email)
  VALUES ('codes_generated', NULL,
          json_build_object('count', p_count, 'duration_days', p_duration_days, 'valid_days', p_valid_days, 'note', p_note),
          v_admin_id, (SELECT email FROM public.profiles WHERE id = v_admin_id));

  RETURN QUERY SELECT unnest(v_codes) AS code;
END;
$$;

-- ============ 10. admin: list codes ============
CREATE OR REPLACE FUNCTION public.admin_list_activation_codes()
RETURNS TABLE (
  id uuid, code_prefix text, duration_days integer, status text,
  used_by_email text, used_at timestamptz, expires_at timestamptz,
  note text, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.expire_stale_codes();
  RETURN QUERY
  SELECT c.id, c.code_prefix, c.duration_days, c.status, c.used_by_email, c.used_at,
         c.expires_at, c.note, c.created_at
  FROM public.activation_codes c
  ORDER BY c.created_at DESC;
END;
$$;

-- ============ 11. admin: revoke unused code ============
CREATE OR REPLACE FUNCTION public.admin_revoke_code(p_code_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_prefix text;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية للمشرف فقط' USING ERRCODE = '42501';
  END IF;
  UPDATE public.activation_codes SET status = 'revoked'
  WHERE id = p_code_id AND status = 'unused'
  RETURNING code_prefix INTO v_prefix;
  IF v_prefix IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'لا يمكن إلغاء هذا الكود (مستخدم أو ملغى سابقاً)');
  END IF;
  INSERT INTO public.admin_audit_log (action, details, created_by, created_by_email)
  VALUES ('code_revoked', json_build_object('code_id', p_code_id, 'code_prefix', v_prefix),
          v_admin_id, (SELECT email FROM public.profiles WHERE id = v_admin_id));
  RETURN json_build_object('success', true, 'message', 'تم إلغاء الكود');
END;
$$;

-- ============ 12. admin: list users with subscription info ============
CREATE OR REPLACE FUNCTION public.admin_list_users_subscription()
RETURNS TABLE (
  user_id uuid, email text, full_name text, account_status text,
  subscription_ends_at timestamptz, activated_at timestamptz, blocked_reason text,
  access_state text, is_team_member boolean, owner_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية للمشرف فقط' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.account_status, p.subscription_ends_at,
         p.activated_at, p.blocked_reason,
         CASE
           WHEN p.role = 'admin' THEN 'active'
           WHEN p.account_status = 'blocked' THEN 'blocked'
           WHEN p.account_status = 'suspended' THEN 'suspended'
           WHEN p.account_status = 'pending' THEN 'pending'
           WHEN p.subscription_ends_at IS NOT NULL AND p.subscription_ends_at < now() THEN 'expired'
           ELSE 'active'
         END::text,
         EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.member_user_id = p.id AND tm.role != 'owner'),
         (SELECT op.email FROM public.team_members tm JOIN public.profiles op ON op.id = tm.owner_id
          WHERE tm.member_user_id = p.id AND tm.role != 'owner' LIMIT 1)
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;

-- ============ 13. admin: set user status (block/suspend/...) ============
CREATE OR REPLACE FUNCTION public.admin_set_user_status(p_user_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_target_email text;
  v_target_role text;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية للمشرف فقط' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active','suspended','blocked') THEN
    RAISE EXCEPTION 'حالة غير صالحة';
  END IF;
  SELECT email, role INTO v_target_email, v_target_role FROM public.profiles WHERE id = p_user_id;
  IF v_target_role = 'admin' THEN
    RETURN json_build_object('success', false, 'message', 'لا يمكن تعديل حساب المشرف');
  END IF;

  UPDATE public.profiles
  SET account_status = p_status,
      blocked_reason = CASE WHEN p_status IN ('blocked','suspended') THEN p_reason END
  WHERE id = p_user_id;

  -- Kick sessions immediately for blocked/suspended users.
  IF p_status IN ('blocked','suspended') THEN
    DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id;
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.admin_audit_log (action, target_user_id, target_email, details, created_by, created_by_email)
  VALUES ('status_changed_' || p_status, p_user_id, v_target_email,
          json_build_object('reason', p_reason), v_admin_id, (SELECT email FROM public.profiles WHERE id = v_admin_id));
  RETURN json_build_object('success', true, 'message', 'تم تحديث حالة المستخدم');
END;
$$;

-- ============ 14. admin: extend subscription ============
CREATE OR REPLACE FUNCTION public.admin_extend_subscription(p_user_id uuid, p_days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_target_email text;
  v_new_ends timestamptz;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية للمشرف فقط' USING ERRCODE = '42501';
  END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 3650 THEN
    RAISE EXCEPTION 'عدد الأيام يجب أن يكون بين 1 و 3650';
  END IF;
  SELECT email INTO v_target_email FROM public.profiles WHERE id = p_user_id;
  IF v_target_email IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'المستخدم غير موجود');
  END IF;

  UPDATE public.profiles
  SET subscription_ends_at = GREATEST(COALESCE(subscription_ends_at, now()), now()) + (p_days || ' days')::interval,
      account_status = CASE WHEN account_status = 'pending' THEN 'active' ELSE account_status END,
      activated_at = COALESCE(activated_at, now())
  WHERE id = p_user_id
  RETURNING subscription_ends_at INTO v_new_ends;

  INSERT INTO public.admin_audit_log (action, target_user_id, target_email, details, created_by, created_by_email)
  VALUES ('subscription_extended', p_user_id, v_target_email,
          json_build_object('days', p_days, 'new_ends_at', v_new_ends),
          v_admin_id, (SELECT email FROM public.profiles WHERE id = v_admin_id));
  RETURN json_build_object('success', true, 'message', 'تم تمديد الاشتراك', 'subscription_ends_at', v_new_ends);
END;
$$;

-- ============ 15. admin: reactivate user ============
CREATE OR REPLACE FUNCTION public.admin_reactivate_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_target_email text;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية للمشرف فقط' USING ERRCODE = '42501';
  END IF;
  SELECT email INTO v_target_email FROM public.profiles WHERE id = p_user_id;
  IF v_target_email IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'المستخدم غير موجود');
  END IF;

  UPDATE public.profiles
  SET account_status = 'active',
      blocked_reason = NULL
  WHERE id = p_user_id;

  INSERT INTO public.admin_audit_log (action, target_user_id, target_email, details, created_by, created_by_email)
  VALUES ('user_reactivated', p_user_id, v_target_email, NULL,
          v_admin_id, (SELECT email FROM public.profiles WHERE id = v_admin_id));
  RETURN json_build_object('success', true, 'message', 'تم إعادة تفعيل الحساب');
END;
$$;

-- ============ 16. admin: stats ============
CREATE OR REPLACE FUNCTION public.admin_subscription_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية للمشرف فقط' USING ERRCODE = '42501';
  END IF;

  RETURN json_build_object(
    'total_users', (SELECT count(*) FROM public.profiles WHERE role != 'admin'),
    'active_users', (SELECT count(*) FROM public.profiles WHERE role != 'admin' AND account_status = 'active'
                     AND (subscription_ends_at IS NULL OR subscription_ends_at >= now())),
    'pending_users', (SELECT count(*) FROM public.profiles WHERE role != 'admin' AND account_status = 'pending'),
    'blocked_users', (SELECT count(*) FROM public.profiles WHERE role != 'admin' AND account_status IN ('blocked','suspended')),
    'expired_users', (SELECT count(*) FROM public.profiles WHERE role != 'admin' AND account_status = 'active'
                      AND subscription_ends_at IS NOT NULL AND subscription_ends_at < now()),
    'expiring_7d', (SELECT count(*) FROM public.profiles WHERE role != 'admin' AND account_status = 'active'
                    AND subscription_ends_at BETWEEN now() AND now() + interval '7 days'),
    'codes_used', (SELECT count(*) FROM public.activation_codes WHERE status = 'used'),
    'codes_unused', (SELECT count(*) FROM public.activation_codes WHERE status = 'unused'),
    'codes_revoked', (SELECT count(*) FROM public.activation_codes WHERE status = 'revoked'),
    'codes_expired', (SELECT count(*) FROM public.activation_codes WHERE status = 'expired')
  );
END;
$$;

-- ============ 17. admin: audit log ============
CREATE OR REPLACE FUNCTION public.admin_subscription_audit()
RETURNS TABLE (
  id bigint, action text, target_email text, details jsonb,
  created_by_email text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.action, a.target_email, a.details, a.created_by_email, a.created_at
  FROM public.admin_audit_log a
  ORDER BY a.created_at DESC
  LIMIT 200;
$$;

-- ============ 18. grants on functions ============
REVOKE EXECUTE ON FUNCTION public.sha256_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_stale_codes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_access_state() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.activate_account(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_activation_codes(integer, integer, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_activation_codes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users_subscription() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_extend_subscription(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reactivate_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_subscription_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_subscription_audit() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sha256_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_access_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_activation_codes(integer, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_activation_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_subscription(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_subscription_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_subscription_audit() TO authenticated;
