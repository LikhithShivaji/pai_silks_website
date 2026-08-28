-- Migration 008 — store the shipping fee as its own column on the order
--
-- Fixes: the data half of CLAUDE.md AB-16
--
-- WHY
-- Phase 1 (CF-03) made the server add a ₹100 shipping fee, computed from a
-- server-owned constant, into orders.total_amount. Nothing recorded it
-- separately, so the breakdown of a charge was unrecoverable: total_amount was
-- a single number with the fee baked in.
--
-- The admin panel meanwhile ignored total_amount entirely and re-summed the
-- order lines itself. Those two facts together mean the admin sees LESS than
-- the customer paid, on every order placed since the shipping fix:
--
--   customer paid       4099.00   (3999 goods + 100 shipping)
--   admin panel shows   3999.00
--   difference           100.00   -- the shipping fee, invisible to the admin
--
-- Verified against a real order row before writing this migration.
--
-- WHY A COLUMN RATHER THAN DERIVING IT
-- The fee can be derived today as total_amount - SUM(line items), and that is
-- correct while the total is made of exactly two parts. It stops being correct
-- the moment a discount, coupon or tax is introduced: the subtraction would
-- silently relabel that amount as "shipping" with nothing to flag it. Razorpay
-- is the next integration and payment reconciliation needs the charge broken
-- down exactly, so the fee is stored rather than inferred.
--
-- BACKFILL: 0.00, and that is factually right, not a placeholder
-- Every existing order predates the shipping fix, so no shipping was ever
-- charged on them. Their total_amount equals the sum of their line items —
-- confirmed for all four rows. NOT NULL DEFAULT 0.00 therefore describes the
-- existing data accurately, and new orders write the real value explicitly.
--
-- TYPE: DECIMAL(10,2) — matches orders.total_amount. Never FLOAT for money.
--
-- SAFE TO RE-RUN? No — ALTER TABLE ADD COLUMN fails if the column exists.
-- Check first:
--   SELECT COUNT(*) FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'shipping_fee';
--   -- 0 = not yet applied, 1 = already applied, skip this file.

ALTER TABLE orders
  ADD COLUMN shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00
  COMMENT 'Shipping charged on this order, included in total_amount. 0.00 for orders placed before migration 008.'
  AFTER total_amount;

-- Verify: column exists, and every pre-existing order still reconciles —
-- total_amount should equal line items + shipping_fee for every row.
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'shipping_fee')  AS column_added,
  (SELECT COUNT(*) FROM orders)                                     AS total_orders,
  (SELECT COUNT(*) FROM orders WHERE shipping_fee = 0.00)           AS backfilled_zero;

SELECT o.order_id,
       o.total_amount,
       o.shipping_fee,
       COALESCE(SUM(oi.price * oi.quantity), 0)                                  AS line_items,
       o.total_amount - o.shipping_fee - COALESCE(SUM(oi.price * oi.quantity),0) AS should_be_zero
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.order_id
GROUP BY o.order_id, o.total_amount, o.shipping_fee;
