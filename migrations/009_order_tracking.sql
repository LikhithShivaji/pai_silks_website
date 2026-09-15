-- Migration 009 — record which carrier shipped an order, and its consignment number
--
-- Fixes: CLAUDE.md DB-09
--
-- WHY
-- There is nowhere to record a tracking number. The admin ships a parcel via
-- DTDC or India Post, gets a consignment number on the receipt, and has no
-- field to enter it into. The customer therefore opens My Orders and sees a
-- status badge reading "Shipped" and nothing else — no number, no link, no way
-- to locate their parcel — and has to message the shop to ask.
--
-- WHY THIS IS NOW LAUNCH-BLOCKING RATHER THAN DEFERRED
-- DTDC confirmed on 2026-09-01 that API credentials are assigned only AFTER the
-- website is live. India Post has no self-service API at all. So no automated
-- carrier tracking can exist at go-live, and manual entry is not a stopgap —
-- it is the only tracking possible on day one. The Shipping Policy drafted for
-- the Razorpay application also tells customers they can see their order status
-- on the site, so shipping without this would publish a promise the site does
-- not keep.
--
-- WHY TWO COLUMNS AND NOT ONE
-- A consignment number alone is unusable. 'EX123456789IN' identifies nothing
-- without knowing which carrier holds the parcel: the tracking URL differs per
-- carrier, and later the API endpoint and credentials will too. The shop uses
-- BOTH carriers and chooses per destination, so the carrier must be stored per
-- order rather than assumed globally.
--
-- NOT THROWAWAY WORK
-- A carrier tracking API takes a consignment number as its INPUT. These columns
-- are what such an API plugs into, so when DTDC issues credentials after launch
-- nothing here is discarded — only the customer-facing display changes, from
-- "here is your number and a link" to live status.
--
-- WHY NULLABLE, WITH NO BACKFILL
-- All five existing orders were shipped before any of this existed, and their
-- consignment numbers are not recorded anywhere — not in the database, not in
-- the application. NULL is therefore the honest value: "not known", which is
-- true. A default of '' would assert that the order has an empty consignment
-- number, which is a different and false claim, and it would make "has this
-- been dispatched?" impossible to answer in SQL.
--
-- TYPES
--   consignment_number VARCHAR(50) — India Post numbers are 13 characters
--     (e.g. EX123456789IN); DTDC's are shorter. 50 leaves room for either,
--     and for a carrier changing its format, without being wasteful.
--   carrier VARCHAR(20) — holds 'DTDC' or 'India Post'. Deliberately NOT a
--     MySQL ENUM: adding a third carrier to an ENUM requires another ALTER
--     TABLE on a table that is being written to, whereas the allowed values
--     are already validated in the application layer (validators.js), which
--     is where the same check for order status also lives.
--
-- ⚠️ NOT A CONSTRAINT, AND DELIBERATELY SO
-- Nothing here enforces "if carrier is set then consignment_number must be
-- set". The pairing is enforced in the application, where a helpful error
-- message can be returned. A CHECK constraint would reject the write with an
-- opaque database error and no way to explain it to the admin.
--
-- SAFE TO RE-RUN? No — ALTER TABLE ADD COLUMN fails if the column exists.
-- Check first:
--   SELECT COUNT(*) FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME = 'orders'
--      AND COLUMN_NAME IN ('consignment_number', 'carrier');
--   -- 0 = not yet applied, 2 = already applied, skip this file.

ALTER TABLE orders
  ADD COLUMN carrier VARCHAR(20) NULL
    COMMENT 'Carrier that shipped this order: DTDC or India Post. NULL until dispatched.'
    AFTER payment_status,
  ADD COLUMN consignment_number VARCHAR(50) NULL
    COMMENT 'Carrier tracking number from the despatch receipt. NULL until dispatched. Entered by the admin; will be API-populated if a booking API is adopted.'
    AFTER carrier;

-- Verify: both columns exist, are nullable, and every existing row is NULL on
-- both (no accidental default was applied).
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME IN ('consignment_number', 'carrier'))          AS columns_added,
  (SELECT COUNT(*) FROM orders)                                       AS total_orders,
  (SELECT COUNT(*) FROM orders WHERE carrier IS NULL)                 AS carrier_null,
  (SELECT COUNT(*) FROM orders WHERE consignment_number IS NULL)      AS consignment_null;

-- Expected: columns_added = 2, and carrier_null = consignment_null = total_orders.

-- Confirm nullability was honoured rather than silently defaulted.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'orders'
  AND COLUMN_NAME IN ('carrier', 'consignment_number');

-- Expected: both IS_NULLABLE = YES, both COLUMN_DEFAULT = NULL.
