# Deployment

## Architecture

```
Hostinger (static hosting)  ←  dist/ upload   ←  frontends
Render (Node services)      ←  git push       ←  backends
Hostinger MySQL             ←  live database
```

| Component | Domain | Hosted on | Deploy method |
|---|---|---|---|
| `client-frontend/client` | `paisilks.com` | Hostinger | upload `dist/` |
| `admin-frontend/admin` | `admin.paisilks.com` | Hostinger | upload `dist/` |
| `client-backend` | `pai-silks-website-1.onrender.com` | Render | git push |
| `admin-backend` | `pai-silks-website.onrender.com` | Render | git push |
| Database | — | Hostinger MySQL | — |

> Note the backend naming is counter-intuitive: `pai-silks-website` (no suffix)
> is the **admin** backend, and `pai-silks-website-1` is the **customer** one.

---

## How frontend config works — read this before changing any URL

**Vite substitutes `VITE_*` variables at BUILD time, not at runtime.**

When you run `npm run build`, Vite finds every `import.meta.env.VITE_ADMIN_API_BASE`
in the source and replaces it with the literal string from the env file. The
output in `dist/` has the URL hardcoded.

```
source:  fetch(`${ADMIN_API}/api/getcategory`)
dist/:   fetch("https://pai-silks-website.onrender.com/api/getcategory")
```

Consequences:

- **You never upload `.env` to Hostinger.** It has already done its job by the
  time the build finishes. Hostinger just serves files that contain the URL.
- **Which env file is present at build time decides where the deployed site
  points.**
- **`VITE_*` values are PUBLIC.** They are plain text in the shipped JavaScript.
  Never put an AWS key, API secret, or JWT secret in one.

### Which file is loaded when

| Command | Loads | Points at |
|---|---|---|
| `npm run dev` | `.env` | `localhost:9032` / `localhost:9034` |
| `npm run build` | `.env.production` | the Render URLs |

Vite selects `.env.production` for `build` automatically — no flag needed.

### Files, and which are committed

| File | Committed? | Purpose |
|---|---|---|
| `.env` | **No** (gitignored) | your local dev URLs |
| `.env.production` | **Yes — must stay** | the URLs baked into production builds |
| `.env.example` | Yes | documentation for new machines |

> If `.env.production` is ever deleted, a production build silently falls back
> to `localhost` and the deployed site breaks. It stays in git for that reason.

---

## Deploying a frontend

```bash
cd admin-frontend/admin        # or client-frontend/client
npm ci
npm run build
# upload the CONTENTS of dist/ to the Hostinger web root
```

To verify the build picked up the right URLs before uploading:

```bash
grep -o "onrender\.com" dist/assets/*.js | wc -l   # expect > 0
grep -o "localhost:903[0-9]" dist/assets/*.js      # expect no output
```

---

## ⚠️ The `shared/` folder changes how the backends must be deployed

`shared/` holds the code both backends use — `sanitizeError`, `validate`,
`rejectNonScalarBody`, `withTransaction`. There is one copy, and each backend
requires it via `../../shared/...`.

**`shared/` is NOT a service.** It does not run, listen on a port, or have a
URL. It is files read at boot, like anything in `node_modules`. **No third
Render service, no extra cost.**

But it does change two things about each backend's Render configuration:

| Setting | Was | Must become |
|---|---|---|
| Root Directory | `client-backend` | **blank** (the repo root) |
| Build Command | `npm ci` | `npm --prefix shared ci && cd client-backend && npm ci` |
| Start Command | `npm start` | `cd client-backend && npm start` |

(and the same for `admin-backend`).

**Why Root Directory must be blank:** Render uploads only the directory you name.
With it set to `client-backend`, the `shared/` folder — one level up — is not on
the server, and the service dies on boot with `MODULE_NOT_FOUND`.

**Why `npm --prefix shared ci` is required:** `shared/` has its own
`package.json` and depends on `express-validator`. Node resolves that by walking
*up* from `shared/` looking for `node_modules`, and finds none — the backends'
copies are in their own folders, not above `shared/`. Verified locally: without
installing `shared/`, both backends fail with
`Cannot find module 'express-validator'` from `shared/validate.js`. Its
`package-lock.json` is committed, so `npm ci` is reproducible.

> This was hit and fixed during development, not discovered in production.
> If a backend ever fails to boot on Render with `MODULE_NOT_FOUND` pointing at
> `shared/`, one of these two settings is wrong.

---

## Deploying a backend

Backends read config from `process.env` at **runtime**, so they work
differently from the frontends.

**Do not upload a `.env` file to Render.** Set the variables in the Render
dashboard instead: *Service → Environment → Add Environment Variable.*

Required per backend:

```
DB_HOST       Hostinger MySQL host
DB_USER
DB_PASS
DB_NAME
DB_PORT       3306
NODE_ENV      production
PORT          (Render provides this — read it, don't hardcode)
CORS_ORIGINS  see below
JWT_SECRET    (added in Phase 2)
```

`admin-backend` additionally needs the three `CLOUDINARY_*` keys.

### Health check path — set this for both services

Set **Health Check Path** to `/health` on both Render services.

```
Health Check Path    /health
```

Both backends expose `GET /health` (Phase 6 Slice 3). It is mounted outside
`/api` **on purpose**: everything under `/api` is rate-limited, and a health
check polled every few seconds would eventually throttle itself and make a
healthy service look down.

It reports **readiness, not just liveness** — it runs `SELECT 1` and returns:

| DB state | Status | Body |
|---|---|---|
| reachable | `200` | `{"status":"ok","db":"up"}` |
| unreachable | `503` | `{"status":"degraded","db":"down"}` |

So Render will not route traffic to an instance that is running but cannot
reach MySQL. The body carries no host, database name, version or error text —
it is unauthenticated, so the reason for a failure goes to the logs only.

⚠️ **`PORT` was hardcoded until Phase 6 Slice 3** (`9034`/`9032`). This file
already documented the rule; the code simply did not follow it. Had it shipped,
each service would have bound to a port Render was not routing to — the health
check would never pass, the deploy would be marked failed, and the service's own
log would read `Server running on port 9032` the whole time.

> **The backends now refuse to start if any `DB_*` variable is missing.** That
> is deliberate — they previously fell back to `root`/`admin123` silently. If a
> Render deploy crashes on boot, check the logs for
> `Missing required environment variable`.

### Content-Security-Policy — set as a Hostinger response header, not in HTML

⚠️ **Outstanding at deploy.** `AF-35` asks for a CSP on the admin panel. It is
deliberately **not** a `<meta>` tag in `index.html`, because a meta tag is baked
in at build time while the policy must allow the API origin — which differs
between local development and production. A `connect-src` missing the real API
origin does not degrade gracefully: every request is blocked and the panel stops
working, with the cause visible only in the browser console.

Set it instead as a response header where the static files are served, so it can
differ per environment and change without a rebuild. A starting policy for both
frontends:

```
Content-Security-Policy:
  default-src 'self';
  img-src 'self' data: https://res.cloudinary.com https://placehold.co;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://<client-backend>.onrender.com https://<admin-backend>.onrender.com;
  frame-ancestors 'none';
```

`img-src` must include **Cloudinary** (all product images) and `placehold.co`
(the fallback used when an image is missing). `style-src` needs
`'unsafe-inline'` for Tailwind's injected styles. **Test in a browser with the
console open before committing to it** — a CSP that blocks a real request fails
silently from the user's point of view.

### CORS_ORIGINS — exact production values

Both services must allow **both** domains, because both frontends call both
backends:

**client-backend** (`pai-silks-website-1`):
```
CORS_ORIGINS=https://paisilks.com,https://admin.paisilks.com
```

**admin-backend** (`pai-silks-website`):
```
CORS_ORIGINS=https://admin.paisilks.com,https://paisilks.com
```

Why each needs the other's domain:
- the admin panel reads bestsellers and collections from client-backend (`AF-07`)
- the storefront reads its product catalogue from admin-backend (`CF-22` — once
  that is re-pointed in Phase 5, `https://paisilks.com` can be dropped from
  admin-backend's list)

Add `https://www.paisilks.com` as well if the site is served from `www` rather
than redirecting to the apex domain.

> **If `CORS_ORIGINS` is not set in Render, the live site breaks.** The built-in
> default is localhost only, so browsers will block every API call from
> production. This fails silently from the server's point of view — you will
> see CORS errors in the browser console, not in the Render logs.

`admin-backend` additionally needs:

```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

> Hostinger MySQL must permit remote connections from Render's IPs, otherwise
> the backend cannot reach the database.

---

---

## Database migrations

`migrations/*.sql` holds schema changes that must be applied to **both** local
and production. They are tracked in git (the root `.gitignore` ignores `*.sql`
generally but has an explicit `!migrations/` exception, so dumps stay out while
migrations stay in).

Apply in numeric order:

```bash
# local
mysql -u root -p db < migrations/001_cart_unique_user_product.sql

# production — run the file's contents in Hostinger phpMyAdmin
```

### Pending for the next production deploy

| Migration | Status | Note |
|---|---|---|
| `001_cart_unique_user_product.sql` | local ✅ · production ❌ | **Must run BEFORE the new backend code goes live** — `addToCart` now relies on `ON DUPLICATE KEY UPDATE`, which needs this unique index. |
| `002_session_token_widen.sql` | local ✅ · production ❌ | **Must run BEFORE the new backend code goes live.** `session.token` was `VARCHAR(255)`; a JWT measures 243 characters. Without this, MySQL either errors on login or — in non-strict mode — silently truncates the token, which breaks verification and logs users out at random. |
| `004_phone_number_international.sql` | local ✅ · production ❌ | **Must run BEFORE the new backend code goes live.** Widens `master_user.phone_number` from `VARCHAR(15)` to `VARCHAR(20)`. Signup, profile and checkout now store E.164 (`+919876543210`), and with a longer country code the old width overflows — in non-strict SQL mode MySQL **silently truncates**, producing a stored number that cannot be dialled. |
| `005_referential_integrity.sql` | local ✅ · production ❌ | Adds **11 foreign keys** (1 → 12), cleans orphan rows first, backfills `orders.status`, and adds `UNIQUE(product_id)` on `product_stock`. ⚠️ **Run during a quiet window and take a dump first** — this is the largest structural change of the set, and it will **fail** if production holds orphan rows that local did not. The file cleans known orphans before adding constraints; read its header before running. ⚠️ It also changes the handover wipe: `DELETE FROM product` now fails with `ERROR 1451` until sales rows are removed — see *Clearing the placeholder catalogue* below. |
| `006_backfill_missing_product_stock.sql` | local ✅ · production ❌ | Gives every live product a `product_stock` row at qty **300**. Locally **29 of 35 products had none**, so `getStock` returned 0 and checkout rejected them with "Insufficient stock" after the customer had filled in their address. ⚠️ **Production may have a different set of stranded products, and 300 is placeholder data** — re-run the file's pre-flight query against production and decide the quantity before applying. Pair with `AB-14a` (the transaction fix), which stops new ones being created. |
| `008_order_shipping_fee.sql` | local ✅ · production ❌ | **Must run BEFORE the new backend code goes live** — `createOrder` now inserts into `orders.shipping_fee`, so without this column every checkout fails with `ER_BAD_FIELD_ERROR`. Adds `DECIMAL(10,2) NOT NULL DEFAULT 0.00`. The fee is already inside `total_amount`; this records it separately so a charge can be broken down (needed for Razorpay reconciliation). ⚠️ **The 0.00 backfill is only correct for orders placed before the shipping fee existed.** Production may hold orders created *after* the Phase 1 fee went live — the file's verification query flags any row where `total_amount − shipping_fee − line_items ≠ 0`; check it before trusting the backfill. |
| `007_order_contact_phone.sql` | local ✅ · production ❌ | **Must run BEFORE the new backend code goes live** — `createOrder` now inserts into `orders.contact_phone`, so without this column every checkout fails with `ER_BAD_FIELD_ERROR`. Adds a nullable `VARCHAR(20)` holding the delivery contact captured at checkout, which was previously discarded on every order. Existing rows stay `NULL` and fall back to `master_user.phone_number` when displayed. Not re-runnable — the file's header carries a pre-flight check. |
| `003_remove_shared_password_accounts.sql` | local ✅ · production ❌ | Deletes `customer1@gmail.com` and `abcd234@gmail.com`, which shared the **admin's** password hash. Safe to run at any point. Does **not** fix the admin password — see below. |

### ⚠️ Also required at deploy: rotate the admin password

Migration 003 removes the other two holders of the shared hash, but
`admin123@gmail.com` still uses it. Rotate separately:

```bash
node scripts/set-password.js admin123@gmail.com
```

It prompts for a password (hidden — never in shell history) and prints an
`UPDATE`. Run that statement against **both** local and Hostinger production.
This is `SEC-02b` in `CLAUDE.md`.

> Migration 001 will **fail** if production has accumulated duplicate
> `(user_id, product_id)` cart rows — which is likely, since that is exactly the
> bug it fixes. Local was clean; production may not be. The migration file's
> header contains a pre-flight query and the SQL to collapse duplicates first.

---

## Clearing the placeholder catalogue before handover

The current products, customers and orders are all placeholder data. Before the
client takes over, that gets wiped and replaced with their real inventory.

**Since migration 005 added foreign keys, deletion order now matters.** A plain
`DELETE FROM product` fails:

```
ERROR 1451: Cannot delete or update a parent row: a foreign key constraint
fails (`db`.`order_items`, CONSTRAINT `fk_order_items_product`)
```

That is the `RESTRICT` rule working as designed — it exists so a stray delete
can never destroy sales history. For a deliberate reset you remove the
referencing rows first:

Run the deletes inside a transaction, so a failure part-way leaves the database
whole rather than half-emptied:

```sql
START TRANSACTION;

-- 1. sales records first (RESTRICT blocks everything until these are gone)
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM payments;
DELETE FROM shipments;

-- 2. now products can go. cart, wishlist, product_images and product_stock
--    are ON DELETE CASCADE, so they clear themselves — no need to touch them.
DELETE FROM product;

-- 3. categories
DELETE FROM category;

-- 4. customers. KEEP the admin (role_id = 0).
DELETE FROM session     WHERE user_id IN (SELECT user_id FROM master_user WHERE role_id <> 0);
DELETE FROM master_user WHERE role_id <> 0;

-- 5. check before committing — every count should be 0 except the admin
SELECT 'product' t, COUNT(*) n FROM product
UNION ALL SELECT 'orders',         COUNT(*) FROM orders
UNION ALL SELECT 'order_items',    COUNT(*) FROM order_items
UNION ALL SELECT 'cart',           COUNT(*) FROM cart
UNION ALL SELECT 'wishlist',       COUNT(*) FROM wishlist
UNION ALL SELECT 'product_images', COUNT(*) FROM product_images
UNION ALL SELECT 'product_stock',  COUNT(*) FROM product_stock
UNION ALL SELECT 'category',       COUNT(*) FROM category
UNION ALL SELECT 'customers',      COUNT(*) FROM master_user WHERE role_id <> 0
UNION ALL SELECT 'ADMIN (kept)',   COUNT(*) FROM master_user WHERE role_id = 0;

COMMIT;   -- or ROLLBACK if anything above looks wrong
```

```sql
-- 6. optional, AFTER the commit: restart ids so the client's first product is #1
ALTER TABLE product      AUTO_INCREMENT = 1;
ALTER TABLE orders       AUTO_INCREMENT = 1;
ALTER TABLE master_user  AUTO_INCREMENT = 2;   -- 1 is the admin
```

> This exact sequence was executed against the local database on 2026-08-26
> inside a rolled-back transaction. Every table reached 0 and the admin row
> survived, so the ordering is verified rather than assumed.
>
> `ALTER TABLE` is DDL — MySQL commits implicitly, so step 6 cannot be part of
> the transaction and must come after.

> **Take a dump first.** `mysqldump -u root -p db > pre-handover-backup.sql`.
> None of the above is reversible, and step 1 destroys the only record that
> those orders ever existed.

> Do **not** delete the admin row (`role_id = 0`) — it is the only way into the
> panel. Rotate its credentials instead (`SEC-02b`).

---

### Deploy order

```
1. Run pending migrations against Hostinger MySQL
2. Deploy the backends to Render (with env vars set)
3. Build and upload the frontends to Hostinger
```

Backends before frontends, and migrations before backends — each step depends
on the previous one being live.

---

## Local development

```bash
brew services start mysql
```

Four terminals:

```bash
cd admin-backend            && npm start                    # :9032
cd client-backend           && npm start                    # :9034
cd admin-frontend/admin     && npm run dev -- --port 9031   # :9031
cd client-frontend/client   && npm run dev -- --port 9033   # :9033
```

Local frontends talk to local backends via `.env`. Nothing touches production.

> After changing any `.env` file you must **restart** the dev server — Vite
> reads env files only at startup.

---

## Planned changes

- **Images → AWS S3** (replacing Cloudinary). AWS credentials must live only in
  the backend's Render environment variables. The browser must never hold them:
  either upload through the backend, or have the backend issue a short-lived
  presigned URL. The current Cloudinary setup already follows this rule — no key
  exists in either frontend. Preserve that property.
- **Razorpay** — see `CLAUDE.md`, Deferred work.
- **India Post tracking** — see `CLAUDE.md`, Deferred work.
