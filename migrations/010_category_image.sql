-- Migration 010 — give each category an image
--
-- Fixes: the data half of CLAUDE.md CF-35
--
-- WHY
-- The homepage "Our Categories" strip renders six tiles from a HARDCODED
-- frontend file (src/categoryData.js) whose names match nothing in the
-- catalogue. Verified 2026-08-31: all six — "Mysore Silk Saree",
-- "Kanchipuram Silk", "Cotton Silk Saree", "traditional Banarasi design",
-- "Silk Saree", "Banarasi Silk saree" — return ZERO products, against either
-- the `category` table or `product.category`. Invented data displayed as real,
-- the same class as the fabricated reviews in CF-21.
--
-- The tiles are also not clickable, so today they are purely decorative.
-- Wiring them up as they stand would be WORSE than leaving them dead: six
-- tiles each landing on an empty shop. The fix is to drive the strip from the
-- real categories, which needs somewhere to keep an image per category.
--
-- WHY A COLUMN RATHER THAN A LOOKUP IN FRONTEND CODE
-- Mapping the 7 real categories to images in the frontend works today and
-- breaks the moment the admin adds a category: the new one appears with no
-- tile, or an old mapping points at a category that no longer exists. The
-- admin already manages categories; the image belongs with them.
--
-- NULLABLE, NO BACKFILL — and the storefront must cope
-- All 7 existing categories have no image, so NULL is the honest value. The
-- storefront falls back to one of the existing saree images rather than
-- rendering an empty tile, so the strip looks complete from the moment this
-- ships and improves as real images are uploaded.
--
-- TYPE: VARCHAR(500) — matches product_images.image_url. Cloudinary
-- secure_urls are long and the folder/public_id can grow.
--
-- SAFE TO RE-RUN? No — ALTER TABLE ADD COLUMN fails if the column exists.
--   SELECT COUNT(*) FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME = 'category' AND COLUMN_NAME = 'image_url';
--   -- 0 = not yet applied, 1 = already applied, skip this file.

ALTER TABLE category
  ADD COLUMN image_url VARCHAR(500) NULL
  COMMENT 'Cloudinary URL for this category tile on the homepage. NULL until uploaded; the storefront falls back to a default image.';

-- Verify: column exists, and every existing category is NULL on it.
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'category' AND COLUMN_NAME = 'image_url') AS column_added,
  (SELECT COUNT(*) FROM category WHERE is_deleted = 0)           AS live_categories,
  (SELECT COUNT(*) FROM category WHERE image_url IS NULL)        AS image_null;
