-- 025_drop_legacy_subscriptions.sql
-- The legacy two-tier subscriptions table is no longer referenced anywhere in
-- application code (see M5 cleanup). It was empty before drop. The active
-- model lives in `instrument_subscriptions` + `subscription_courses`.

DROP TABLE IF EXISTS subscriptions CASCADE;
