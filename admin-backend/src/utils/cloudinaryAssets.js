const cloudinary = require("../config/cloudinary");
const { sanitizeError } = require("./safeError");

/**
 * Deleting remote image assets.
 *
 * Before this file existed, `grep -rn destroy src` returned **zero hits**:
 * nothing in this codebase had ever deleted a Cloudinary asset.
 * `deleteImagesByProductId` only removed database rows, so every time an admin
 * replaced a product's images the old files stayed in the paid Cloudinary
 * account forever, unreferenced and unfindable. See CLAUDE.md AB-10.
 */

/**
 * Recover the Cloudinary public_id from a stored secure_url.
 *
 * The database stores only `image_url`, and `destroy()` needs a public_id.
 * Rather than add a column and a migration, the id is derived — the backfill
 * for such a column would have had to derive it from these same URLs anyway,
 * so storing it would add no reliability for the 138 existing rows.
 *
 *   https://res.cloudinary.com/<cloud>/image/upload/v1766833059/products/abc.webp
 *   -> products/abc
 *
 * Verified against the real stored URLs before relying on it.
 *
 * ⚠️ This works because every URL here is a plain `secure_url` with no
 * transformation segment. If delivery transformations are ever introduced
 * (`/upload/w_400,c_fill/v123/...`), this must be revisited — or a `public_id`
 * column added at that point.
 *
 * @returns {string|null} null when the URL is not a recognisable Cloudinary
 *   upload URL, so a caller can skip it rather than delete something arbitrary.
 */
const publicIdFromUrl = (url) => {
  if (typeof url !== "string") return null;

  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) return null;

  // Strip the format extension Cloudinary appends. The public_id itself has
  // none — `format: "webp"` adds `.webp` to the delivery URL only.
  return match[1].replace(/\.[A-Za-z0-9]+$/, "") || null;
};

/**
 * Delete assets by their stored URLs. Best-effort and non-throwing.
 *
 * Deliberately never throws: this is cleanup that runs AFTER the database work
 * has already been committed. A Cloudinary outage must not fail an operation
 * the admin has been told succeeded, and must not roll back a completed
 * transaction. Failures are logged so orphans can be reconciled later.
 */
const destroyImagesByUrl = async (urls = []) => {
  const ids = (Array.isArray(urls) ? urls : [])
    .map(publicIdFromUrl)
    .filter(Boolean);

  if (ids.length === 0) return { deleted: 0, failed: 0 };

  let deleted = 0;
  let failed = 0;

  for (const publicId of ids) {
    try {
      const res = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true,
      });
      // Cloudinary answers 'ok' or 'not found'. 'not found' is not an error
      // worth alarming about — the asset is gone either way, which is the goal.
      if (res && (res.result === "ok" || res.result === "not found")) deleted++;
      else {
        failed++;
        console.error("Cloudinary destroy returned:", res && res.result, publicId);
      }
    } catch (err) {
      failed++;
      console.error("Cloudinary destroy failed:", sanitizeError(err));
    }
  }

  return { deleted, failed };
};

module.exports = { publicIdFromUrl, destroyImagesByUrl };
