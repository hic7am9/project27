/*
# Revert: drop blocked_external_uids table

Removes the blocked_external_uids table that was added to track locally-deleted
Airbnb bookings. Reverts the schema to its previous state.
*/

DROP TABLE IF EXISTS blocked_external_uids CASCADE;
