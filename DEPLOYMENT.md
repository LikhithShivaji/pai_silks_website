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

> **The backends now refuse to start if any `DB_*` variable is missing.** That
> is deliberate — they previously fell back to `root`/`admin123` silently. If a
> Render deploy crashes on boot, check the logs for
> `Missing required environment variable`.

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

```sql
-- 1. sales records first (RESTRICT blocks everything until these are gone)
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM payments;
DELETE FROM shipments;

-- 2. now products can go. cart, wishlist, product_images and product_stock
--    are ON DELETE CASCADE, so they clear themselves.
DELETE FROM product;

-- 3. customers, if those are being cleared too. Keep the admin (role_id = 0).
DELETE FROM session     WHERE user_id IN (SELECT user_id FROM master_user WHERE role_id <> 0);
DELETE FROM master_user WHERE role_id <> 0;

-- 4. optional: restart ids from 1 so the client's first product is #1
ALTER TABLE product      AUTO_INCREMENT = 1;
ALTER TABLE orders       AUTO_INCREMENT = 1;
ALTER TABLE master_user  AUTO_INCREMENT = 2;   -- 1 is the admin
```

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
