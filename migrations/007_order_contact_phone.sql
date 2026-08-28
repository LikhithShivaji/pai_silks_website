-- Migration 007 — store the delivery contact number on the order
--
-- Fixes: the data half of CLAUDE.md AB-42, and completes CF-09
--
-- WHY
-- The checkout form asks the customer for a phone number. Checkout.jsx sends it
-- as `phone_number` in the create-order payload. createOrder never read it:
--
--   sent by Checkout.jsx : customer_name, email, phone_number,
--                          shipping_address, payment_method, items
--   read by createOrder  : shipping_address, payment_method
--
-- and `orders` had no column to hold it. So the number was silently discarded
-- on every single order.
--
-- The inconsistency this leaves is the point: the shipping ADDRESS for a parcel
-- is stored per order, while the contact PHONE for that same parcel was thrown
-- away. A courier label needs both. CF-09 fixed the form so it captures a real
-- number instead of the hardcoded "9999999999" fallback — this migration gives
-- that number somewhere to land, so CF-09 is finally true end to end.
--
-- WHY NOT JUST JOIN master_user.phone_number
-- That is the ACCOUNT holder's number, not the contact for this delivery. A
-- customer ordering a gift enters the recipient's number at checkout; joining
-- the profile would show the buyer's instead, confidently and wrongly. The
-- profile number stays as the fallback for orders that predate this column.
--
-- NULLABLE, deliberately
-- The four existing orders have no captured number and there is nothing to
-- backfill them with — inventing one would be worse than leaving it absent.
-- Reads use COALESCE(o.contact_phone, mu.phone_number), so old orders fall back
-- to the account phone and new orders show what the customer actually typed.
--
-- WIDTH
-- VARCHAR(20) matches master_user.phone_number as widened by migration 004.
-- E.164 with a country code ("+919876543210") is 13 characters; 20 leaves room
-- for longer international codes without another ALTER.
--
-- SAFE TO RE-RUN? No — ALTER TABLE ADD COLUMN fails if the column exists.
-- Check first:
--   SELECT COUNT(*) FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'contact_phone';
--   -- 0 = not yet applied, 1 = already applied, skip this file.

ALTER TABLE orders
  ADD COLUMN contact_phone VARCHAR(20) NULL
  COMMENT 'Delivery contact given at checkout. NULL for orders placed before migration 007; readers fall back to master_user.phone_number.'
  AFTER shipping_address;

-- Verify: the column exists, is nullable, and every existing order is NULL.
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'contact_phone')      AS column_added,
  (SELECT COUNT(*) FROM orders)                                          AS total_orders,
  (SELECT COUNT(*) FROM orders WHERE contact_phone IS NULL)              AS awaiting_fallback;
