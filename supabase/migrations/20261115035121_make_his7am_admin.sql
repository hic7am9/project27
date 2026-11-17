/*
# Promote his7am.py@gmail.com to admin

## Changes
- Updates the `role` column in `profiles` for the user with email `his7am.py@gmail.com` from `user` to `admin`.
- No schema changes, no RLS changes.
*/

UPDATE profiles
SET role = 'admin'
WHERE email = 'his7am.py@gmail.com' AND role = 'user';
