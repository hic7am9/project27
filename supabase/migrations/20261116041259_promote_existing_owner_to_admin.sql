/*
# Grant admin role to the existing owner account

1. Plain-English summary
- The only registered account (hic7am.skills@gmail.com) is the app owner but had
  role='user', so every admin-only subscription function rejected it with
  "غير مصرح: هذه العملية للمشرف فقط" and the "الاشتراكات والأكواد" panel failed to load.
- This migration promotes that account to role='admin' and makes it always-active.

2. Security
- Matches the is_admin() / role='admin' checks the subscription functions rely on.
- The hardcoded his7am@gmail.com promotion earlier assumed that email would exist;
  the actual signup used a different address, so we promote by the real account.
*/

UPDATE public.profiles
SET role = 'admin',
    account_status = 'active',
    activated_at = COALESCE(activated_at, now())
WHERE email = 'hic7am.skills@gmail.com';
