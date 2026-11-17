/*
# Remove needs_cleaning status, unify under not_ready

1. Data Migration
- Update all apartments with status = 'needs_cleaning' to status = 'not_ready'.

2. Schema Changes
- Replace the status CHECK constraint on apartments to remove 'needs_cleaning'.

3. Function Updates
- Update mark_apartment_clean() to check for 'not_ready' instead of 'needs_cleaning'.
*/

UPDATE apartments SET status = 'not_ready' WHERE status = 'needs_cleaning';

ALTER TABLE apartments DROP CONSTRAINT IF EXISTS apartments_status_check;

ALTER TABLE apartments
ADD CONSTRAINT apartments_status_check
CHECK (status = ANY (ARRAY['occupied'::text, 'ready'::text, 'not_ready'::text, 'maintenance'::text]));

DROP FUNCTION IF EXISTS mark_apartment_clean(uuid);

CREATE FUNCTION mark_apartment_clean(p_apartment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_cleaner_id uuid := auth.uid();
  v_owner_id uuid;
  v_is_assigned boolean;
BEGIN
  SELECT a.status, a.user_id INTO v_current_status, v_owner_id
  FROM apartments a
  WHERE a.id = p_apartment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apartment not found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM cleaner_apartments
    WHERE cleaner_user_id = v_cleaner_id
      AND apartment_id = p_apartment_id
  ) INTO v_is_assigned;

  IF NOT v_is_assigned THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not assigned to this apartment');
  END IF;

  IF v_current_status != 'not_ready' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apartment is not in a cleanable state');
  END IF;

  UPDATE apartments
  SET status = 'ready', current_booking_id = NULL
  WHERE id = p_apartment_id;

  INSERT INTO cleaning_logs (apartment_id, cleaner_user_id, owner_id)
  VALUES (p_apartment_id, v_cleaner_id, v_owner_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_apartment_clean(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION mark_apartment_clean(uuid) FROM anon;
