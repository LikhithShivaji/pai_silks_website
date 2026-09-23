-- Migration 011 — align the `category` table's collation with the rest of the schema
--
-- Fixes: a latent schema inconsistency found while building CF-35
--
-- WHAT WAS WRONG
-- `category` used utf8mb4_unicode_ci while `product` and `orders` use
-- utf8mb4_0900_ai_ci. A collation is the rulebook MySQL uses to compare text,
-- and it refuses to compare two columns governed by different rulebooks:
--
--   SELECT ... FROM category c
--    WHERE EXISTS (SELECT 1 FROM product p WHERE p.category = c.name)
--   -- ERROR 1267 ER_CANT_AGGREGATE_2COLLATIONS
--
-- The query FAILS rather than returning wrong rows, which is the better
-- failure — but it fails completely.
--
-- WHY IT HAD NEVER BITTEN
-- Comparing a column against a BOUND PARAMETER is fine: the parameter adopts
-- the connection's collation, so there is no conflict. Every query in the app
-- was that shape. The CF-35 homepage-tiles query was the first place a column
-- from `product` was compared with a column from `category`, and it failed
-- immediately.
--
-- WHY IT IS SAFE
-- Both columns are ALREADY utf8mb4. Only the collation changes, so no stored
-- bytes are rewritten — MySQL rebuilds the indexes and updates metadata.
-- Verified before writing this:
--   - no foreign keys reference `category` (nothing downstream to invalidate)
--   - `name` is UNIQUE, and there are ZERO case-insensitive duplicate names,
--     so the rebuilt unique index cannot hit a duplicate-key error
--   - 8 rows
-- Both collations are accent- and case-insensitive, so no two existing names
-- become equal under the new rules.
--
-- ⚠️ THE CODE DOES NOT DEPEND ON THIS HAVING RUN.
-- `getCategoryTilesWithImages` carries an explicit COLLATE on both sides, so it
-- works whether or not this migration has been applied. That is deliberate:
-- production may lag local, and a query that only works post-migration would
-- break the homepage between deploying the code and running the SQL.
--
-- SAFE TO RE-RUN? Yes. Converting a table to the collation it already has is a
-- no-op. Check current state with:
--   SELECT TABLE_COLLATION FROM information_schema.TABLES
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'category';

ALTER TABLE category
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Verify: category now matches product and orders, and no rows were lost.
SELECT TABLE_NAME, TABLE_COLLATION
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('category', 'product', 'orders');

SELECT COUNT(*) AS category_rows,
       COUNT(DISTINCT name) AS distinct_names
  FROM category;

-- And the comparison that previously errored should now run without an
-- explicit COLLATE:
SELECT COUNT(*) AS categories_with_products
  FROM category c
 WHERE c.is_deleted = 0
   AND EXISTS (SELECT 1 FROM product p
                WHERE p.is_deleted = 0
                  AND LOWER(TRIM(p.category)) = LOWER(TRIM(c.name)));
