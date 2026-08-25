-- Migration 005 — clean orphan data, then enforce referential integrity
--
-- Fixes: CLAUDE.md DB-01, DB-03, DB-04
--
-- WHY
-- The database has exactly ONE foreign key in the entire schema
-- (session_ibfk_1 on session.user_id). Nothing else is constrained, so a cart
-- row can point at a product that does not exist, an order_item can reference
-- a deleted order, and application bugs silently create unreachable garbage
-- instead of failing loudly.
--
-- This is not hypothetical — two such rows already exist locally (see step 1).
--
-- ORDER MATTERS. The cleanup must run before the constraints, or the
-- ALTER TABLE statements fail on the rows they are meant to prevent.
--
-- ON DELETE rules (owner-approved, 2026-08-25):
--   cart, wishlist, product_images, product_stock  -> CASCADE
--       These are owned by their parent. Deleting a user should take their
--       cart with it; deleting a product should take its images and stock row.
--
--   orders, order_items, payments, shipments       -> RESTRICT
--       NEVER silently destroy a sales record. RESTRICT means a customer who
--       has ordered cannot be deleted until their orders are dealt with
--       deliberately. That is the correct trade: losing sales history to a
--       stray DELETE is unrecoverable.
--
-- APPLY
--   local:      mysql -u root -p db < migrations/005_referential_integrity.sql
--   production: run in Hostinger phpMyAdmin against u863032788_db
--
-- ⚠️  PRE-FLIGHT — RUN THIS AGAINST PRODUCTION FIRST.
-- Local had 2 orphan cart rows. Production is older and may have more, and in
-- other tables. Every constraint below will FAIL if its table holds an orphan.
-- Check before applying:
--
--   SELECT 'cart.product_id', COUNT(*) FROM cart c
--     LEFT JOIN product p ON p.id=c.product_id WHERE p.id IS NULL
--   UNION ALL SELECT 'cart.user_id', COUNT(*) FROM cart c
--     LEFT JOIN master_user u ON u.user_id=c.user_id WHERE u.user_id IS NULL
--   UNION ALL SELECT 'wishlist.product_id', COUNT(*) FROM wishlist w
--     LEFT JOIN product p ON p.id=w.product_id WHERE p.id IS NULL
--   UNION ALL SELECT 'wishlist.user_id', COUNT(*) FROM wishlist w
--     LEFT JOIN master_user u ON u.user_id=w.user_id WHERE u.user_id IS NULL
--   UNION ALL SELECT 'orders.user_id', COUNT(*) FROM orders o
--     LEFT JOIN master_user u ON u.user_id=o.user_id WHERE u.user_id IS NULL
--   UNION ALL SELECT 'order_items.order_id', COUNT(*) FROM order_items oi
--     LEFT JOIN orders o ON o.order_id=oi.order_id WHERE o.order_id IS NULL
--   UNION ALL SELECT 'order_items.product_id', COUNT(*) FROM order_items oi
--     LEFT JOIN product p ON p.id=oi.product_id WHERE p.id IS NULL
--   UNION ALL SELECT 'product_images.product_id', COUNT(*) FROM product_images pi
--     LEFT JOIN product p ON p.id=pi.product_id WHERE p.id IS NULL
--   UNION ALL SELECT 'product_stock.product_id', COUNT(*) FROM product_stock ps
--     LEFT JOIN product p ON p.id=ps.product_id WHERE p.id IS NULL;
--
-- Any non-zero row must be deleted before continuing.
--
-- ROLLBACK
--   ALTER TABLE cart           DROP FOREIGN KEY fk_cart_user, DROP FOREIGN KEY fk_cart_product;
--   ALTER TABLE wishlist       DROP FOREIGN KEY fk_wishlist_user, DROP FOREIGN KEY fk_wishlist_product;
--   ALTER TABLE orders         DROP FOREIGN KEY fk_orders_user;
--   ALTER TABLE order_items    DROP FOREIGN KEY fk_order_items_order, DROP FOREIGN KEY fk_order_items_product;
--   ALTER TABLE product_images DROP FOREIGN KEY fk_product_images_product;
--   ALTER TABLE product_stock  DROP FOREIGN KEY fk_product_stock_product, DROP INDEX uniq_product_stock_product;
--   ALTER TABLE payments       DROP FOREIGN KEY fk_payments_order;
--   ALTER TABLE shipments      DROP FOREIGN KEY fk_shipments_order;
--   ALTER TABLE orders         MODIFY COLUMN status VARCHAR(50) NULL DEFAULT 'Pending';

-- ===========================================================================
-- 1. Remove orphan cart rows
-- ===========================================================================
-- Local: cart_id 139 and 140, both belonging to sinchanant24@gmail.com,
-- pointing at product_id 2 and 3 — products that do not exist in this
-- database. They were already invisible to the customer, because getCart
-- INNER JOINs product, so deleting them changes nothing she can see.
DELETE c FROM cart c
  LEFT JOIN product p ON p.id = c.product_id
 WHERE p.id IS NULL;

DELETE c FROM cart c
  LEFT JOIN master_user u ON u.user_id = c.user_id
 WHERE u.user_id IS NULL;

DELETE w FROM wishlist w
  LEFT JOIN product p ON p.id = w.product_id
 WHERE p.id IS NULL;

DELETE w FROM wishlist w
  LEFT JOIN master_user u ON u.user_id = w.user_id
 WHERE u.user_id IS NULL;

-- ===========================================================================
-- 2. Backfill orders.status, then forbid NULL   (DB-04)
-- ===========================================================================
-- Two rows hold NULL because the storefront sent `order_status` while the API
-- read `status` — see CF-07, fixed in Phase 1. Both are payment_status='Paid'
-- and months old, and their siblings from the same period (orders 10 and 11)
-- are 'Delivered', so that is the least-wrong backfill value.
--
-- ⚠️  If any NULL order in PRODUCTION was not actually delivered, change this
-- value before running. It is a judgement call on real sales records.
UPDATE orders SET status = 'Delivered' WHERE status IS NULL;

ALTER TABLE orders
  MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending';

-- ===========================================================================
-- 3. product_stock: one row per product   (DB-03)
-- ===========================================================================
-- getStock reads rows[0] — one arbitrary row — while reduceStock decrements
-- EVERY matching row. With duplicates that means availability is under-reported
-- and inventory is over-decremented. See CB-16.
-- Local has no duplicates; this makes that structural.
ALTER TABLE product_stock
  ADD UNIQUE KEY uniq_product_stock_product (product_id);

-- ===========================================================================
-- 4. Foreign keys   (DB-01)
-- ===========================================================================

-- Owned by the parent -> CASCADE
ALTER TABLE cart
  ADD CONSTRAINT fk_cart_user
    FOREIGN KEY (user_id) REFERENCES master_user(user_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_cart_product
    FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE;

ALTER TABLE wishlist
  ADD CONSTRAINT fk_wishlist_user
    FOREIGN KEY (user_id) REFERENCES master_user(user_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_wishlist_product
    FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE;

ALTER TABLE product_images
  ADD CONSTRAINT fk_product_images_product
    FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE;

ALTER TABLE product_stock
  ADD CONSTRAINT fk_product_stock_product
    FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE;

-- Sales records -> RESTRICT. These must never disappear as a side effect.
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES master_user(user_id) ON DELETE RESTRICT;

ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE RESTRICT;

-- Both tables are empty and payments is referenced by no query at all, but
-- constraining them now costs nothing and stops them being populated wrongly
-- when the payment gateway and carrier tracking land.
ALTER TABLE payments
  ADD CONSTRAINT fk_payments_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT;

ALTER TABLE shipments
  ADD CONSTRAINT fk_shipments_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT;
