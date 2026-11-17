/*
# Fix owner profile role to admin

## Overview
The team roles system moved admin access control from profiles.role to team_members.role.
However, the owner's profile still has role='user'. This migration sets the owner's
profile role to 'admin' for consistency, and ensures all future team owners get
the correct profile role.

## Changes
1. Set existing team owners' profile.role to 'admin'
2. No schema changes — data-only fix
*/

UPDATE profiles
SET role = 'admin'
WHERE id IN (
  SELECT DISTINCT owner_id FROM team_members WHERE role = 'owner'
)
AND role != 'admin';
