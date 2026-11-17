-- Promote the actual owner account to admin and activate it.
-- The earlier migrations targeted his7am@gmail.com (wrong email) or
-- matched by team_members ownership, but the profile role stayed 'user'
-- and account_status stayed 'pending', so every admin RPC failed with
-- "غير مصرح: هذه العملية للمشرف فقط".

UPDATE public.profiles
SET role = 'admin',
    account_status = 'active',
    activated_at = COALESCE(activated_at, now()),
    blocked_reason = NULL
WHERE email = 'hic7am.skills@gmail.com';
