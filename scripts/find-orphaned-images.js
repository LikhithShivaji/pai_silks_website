#!/usr/bin/env node
/**
 * Report — and optionally delete — Cloudinary assets that no database row
 * references any more.
 *
 *   node scripts/find-orphaned-images.js            report only (safe)
 *   node scripts/find-orphaned-images.js --delete   actually delete
 *
 * ⚠️ RUN THIS AGAINST THE DATABASE THAT OWNS THE IMAGES.
 *
 * "Orphaned" is decided by comparing Cloudinary against whatever the
 * admin-backend `.env` points `DB_HOST` at. Pointing it at LOCAL and passing
 * --delete would destroy images that PRODUCTION still references — the two
 * databases have diverged. The report prints the database it used; read that
 * line before deleting anything.
 *
 * WHY THESE EXIST
 * Until AB-10 was fixed, every product-image edit uploaded each file TWICE.
 * multer's CloudinaryStorage uploaded it and set `file.path` to the resulting
 * URL; the code then called `uploader.upload(file.path)` again, which made
 * Cloudinary fetch that URL and store a second copy. Only the second was saved
 * to the database, and nothing ever called `destroy()`, so the first stayed in
 * the paid account permanently.
 *
 * Measured on 2026-08-29 before the fix: 246 assets, 135 referenced —
 * 111 orphans, 2.9 MB, 17% of stored bytes.
 *
 * New uploads no longer create orphans. This script is for the existing
 * backlog, and is worth running once before the S3 migration so that migration
 * does not carry 111 dead files across.
 */
const path = require('path');

const BACKEND = path.join(__dirname, '..', 'admin-backend');
require(path.join(BACKEND, 'node_modules', 'dotenv')).config({
  path: path.join(BACKEND, '.env'),
  quiet: true,
});

const cloudinary = require(path.join(BACKEND, 'src', 'config', 'cloudinary'));
const pool = require(path.join(BACKEND, 'src', 'config', 'db'));
const { publicIdFromUrl } = require(path.join(BACKEND, 'src', 'utils', 'cloudinaryAssets'));

const DELETE = process.argv.includes('--delete');

(async () => {
  // Cloudinary pages at 500. Follow next_cursor so a large account is not
  // silently truncated — a truncated listing would under-report, but a
  // truncated *database* read would make everything look orphaned, so the
  // guard below matters more.
  const assets = [];
  let cursor;
  do {
    const page = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'products/',
      max_results: 500,
      next_cursor: cursor,
    });
    assets.push(...page.resources);
    cursor = page.next_cursor;
  } while (cursor);

  const [rows] = await pool.query('SELECT image_url FROM product_images');
  const referenced = new Set(
    rows.map((r) => publicIdFromUrl(r.image_url)).filter(Boolean)
  );

  const orphans = assets.filter((a) => !referenced.has(a.public_id));
  const bytes = orphans.reduce((s, a) => s + (a.bytes || 0), 0);
  const total = assets.reduce((s, a) => s + (a.bytes || 0), 0);

  console.log(`database   : ${process.env.DB_HOST} / ${process.env.DB_NAME}`);
  console.log(`cloudinary : ${assets.length} assets, ${(total / 1024 / 1024).toFixed(1)} MB`);
  console.log(`referenced : ${referenced.size}`);
  console.log(`orphaned   : ${orphans.length}  (${(bytes / 1024 / 1024).toFixed(1)} MB)`);

  if (!DELETE) {
    console.log('\nReport only. Pass --delete to remove them.');
    console.log('Check the `database` line above first — deleting against the');
    console.log('wrong database destroys images the right one still uses.');
    process.exit(0);
  }

  // Refuse to delete if the database returned nothing. An empty, wrong or
  // unreachable database makes EVERY asset look orphaned, and this loop would
  // then wipe the entire account. This guard is the difference between a
  // cleanup and a catastrophe.
  if (referenced.size === 0) {
    console.error('\nABORT: the database reported ZERO referenced images.');
    console.error('That is almost certainly the wrong database — not 100% orphans.');
    process.exit(1);
  }

  let ok = 0;
  let failed = 0;
  for (const a of orphans) {
    try {
      const r = await cloudinary.uploader.destroy(a.public_id, { invalidate: true });
      if (r && (r.result === 'ok' || r.result === 'not found')) ok++;
      else {
        failed++;
        console.error('  destroy returned', r && r.result, a.public_id);
      }
    } catch (err) {
      failed++;
      console.error('  destroy failed', a.public_id, err.message);
    }
  }

  console.log(`\ndeleted ${ok}, failed ${failed}`);
  process.exit(0);
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
