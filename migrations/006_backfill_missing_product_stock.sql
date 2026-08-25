-- Migration 006 — give every live product a stock row
--
-- Fixes: the data half of CLAUDE.md AB-14a
--
-- WHY
-- 29 of 35 live products had NO row in product_stock. getStock returns 0 for a
-- missing row, so checkout rejected them:
--
--   {"success":false,"message":"Insufficient stock for product_id 49"}
--
-- They were visible on the storefront, addable to the cart — several were
-- already sitting in customers' carts — and some were flagged is_new_release.
-- The failure only surfaced at the final step of checkout. None had ever been
-- ordered, which is consistent: nobody could.
--
-- ROOT CAUSE
-- createProduct inserts the product row and the stock row as two separate
-- un-transacted queries. When the second failed, the product was stranded with
-- no stock record and nothing rolled back. The code fix is AB-14a, Slice 3 —
-- this migration only repairs the existing damage.
--
-- VALUE: 300
-- Chosen by the repository owner on 2026-08-25. Safe because the entire product
-- catalogue is placeholder data: it will be deleted and replaced with the
-- client's real inventory before handover, so there is no possibility of
-- overselling a real item.
--
-- ⚠️  Do NOT re-run this against a catalogue holding real inventory. It would
-- set 300 units of anything that happens to be missing a stock row, which on a
-- live shop means selling stock you do not have.
--
-- The INSERT ... SELECT only touches products that have no row, so it is
-- idempotent and cannot overwrite a real quantity that already exists.
--
-- APPLY
--   local:      mysql -u root -p db < migrations/006_backfill_missing_product_stock.sql
--   production: run in Hostinger phpMyAdmin against u863032788_db
--
-- ROLLBACK
--   There is no precise rollback — the previous state was "no row at all".
--   DELETE FROM product_stock WHERE stock_qty = 300;  -- only if nothing else set 300

INSERT INTO product_stock (product_id, stock_qty)
SELECT p.id, 300
  FROM product p
  LEFT JOIN product_stock ps ON ps.product_id = p.id
 WHERE ps.product_id IS NULL
   AND p.is_deleted = 0;
