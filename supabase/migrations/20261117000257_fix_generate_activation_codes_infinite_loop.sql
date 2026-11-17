/*
# Fix infinite loop in generate_activation_codes

1. Problem
- The `v_codes` array was declared as `text[]` but never initialized,
  so it defaulted to NULL.
- The dedup check `EXIT WHEN NOT (v_plain = ANY (v_codes))` evaluated
  `v_plain = ANY(NULL::text[])` which returns NULL (not FALSE).
- `EXIT WHEN NOT NULL` does nothing — the inner LOOP never exits,
  spinning forever until the 8s statement_timeout kills the call
  with "canceling statement due to statement timeout".
- This affected every call to generate_activation_codes, making it
  impossible for the admin to create activation codes.

2. Fix
- Initialize `v_codes := '{}'::text[]` so the array is empty (not NULL).
- `v_plain = ANY('{}'::text[])` returns FALSE on the first iteration,
  so `EXIT WHEN NOT FALSE` = `EXIT WHEN TRUE` exits immediately.
- Also cache the admin email in a variable to avoid repeated subqueries
  inside the loop.
- No schema changes; function signature unchanged.
*/

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
  v_codes text[] := '{}'::text[];
  v_admin_email text;
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

  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;

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
       p_note, v_admin_id, v_admin_email);
  END LOOP;

  INSERT INTO public.admin_audit_log (action, target_email, details, created_by, created_by_email)
  VALUES ('codes_generated', NULL,
          json_build_object('count', p_count, 'duration_days', p_duration_days, 'valid_days', p_valid_days, 'note', p_note),
          v_admin_id, v_admin_email);

  RETURN QUERY SELECT unnest(v_codes) AS code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_activation_codes(integer, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_activation_codes(integer, integer, integer, text) TO authenticated;
