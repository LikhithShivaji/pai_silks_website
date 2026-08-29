# PAI Silks — Security & Correctness Remediation Plan

> **Purpose of this file.** This is the single source of truth for the hardening work on this
> repository. Every vulnerability and correctness defect found in the full audit is listed here with
> its exact location and its intended fix. Nothing gets fixed that is not in this file, and nothing
> in this file gets skipped without being explicitly marked `WON'T FIX` with a reason.
>
> **Audit date:** 2026-08-21 · **Scope:** all four applications in this repo
> **Total findings:** ~190 (66 in this doc are CRITICAL/HIGH)

---

## Table of Contents

1. [How to use this document](#1-how-to-use-this-document)
2. [Hard ordering constraints — read before touching anything](#2-hard-ordering-constraints)
3. [Repository map](#3-repository-map)
4. [PHASE 0 — Secrets rotation (do today, no code)](#phase-0--secrets-rotation)
5. [PHASE 1 — Stop the bleeding](#phase-1--stop-the-bleeding)
6. [PHASE 2 — Authentication & authorization](#phase-2--authentication--authorization)
7. [PHASE 3 — Input validation & error handling](#phase-3--input-validation--error-handling)
8. [PHASE 4 — Database integrity](#phase-4--database-integrity)
9. [PHASE 5 — Correctness bugs](`#phase-5--correctness-bugs)
10. [PHASE 6 — Code quality & hygiene](#phase-6--code-quality--hygiene)
11. [Full findings register](#11-full-findings-register)
    - [Admin backend (AB-*)](#admin-backend--ab)
    - [Client backend (CB-*)](#client-backend--cb)
    - [Admin frontend (AF-*)](#admin-frontend--af)
    - [Client frontend (CF-*)](#client-frontend--cf)
    - [Database schema (DB-*)](#database-schema--db)
    - [Dependencies & tooling (DEP-*)](#dependencies--tooling--dep)
12. [Confirmed FALSE POSITIVES — do not chase these](#12-confirmed-false-positives)
13. [Deferred work](#13-deferred-work)
14. [Verification checklist](#14-verification-checklist)

---

## 1. How to use this document

Each finding has a stable ID (e.g. `AB-07`). When fixing:

1. Find the ID in the [full findings register](#11-full-findings-register).
2. Read **Location** and open that exact file:line before editing.
3. Apply the **Fix** as written. If the fix turns out to be wrong, update this file first, then code.
4. Tick it off in the [verification checklist](#14-verification-checklist).

**Severity meanings:**

| Severity | Meaning |
|---|---|
| **CRITICAL** | Live money loss, data breach, or full system compromise. Fix before go-live, no exceptions. |
| **HIGH** | Exploitable, or breaks a core user journey on 100% of attempts. |
| **MEDIUM** | Exploitable under conditions, or silently corrupts data. |
| **LOW** | Hygiene, dead code, minor UX. Batch these. |

**Status values:** `TODO` · `IN PROGRESS` · `DONE` · `WON'T FIX (reason)` · `DEFERRED (reason)`

---

## 2. Hard ordering constraints

These are not suggestions. Doing them out of order **creates new vulnerabilities.**

### ⛔ CONSTRAINT 1 — Auth before CORS before `credentials`

Currently **zero of the 39 `fetch()` calls** in either frontend send `credentials: 'include'`. Both
logins are cross-origin, so the browser **discards every `Set-Cookie`** the backends send. The entire
session/token/cookie subsystem in both backends is dead code that never touches the wire.

Both backends also run `cors({ origin: true, credentials: true })` — reflect-any-origin **with**
credentials.

**If you add `credentials: 'include'` to the frontend while `origin: true` is still set, every
website on the internet instantly gains authenticated cross-origin access to your API.**

Mandatory order:

```
1. Backend: implement real auth middleware + apply to every route   (CB-01, AB-01)
2. Backend: replace origin:true with an explicit allowlist          (AB-02, CB-07)
3. Backend: add secure + sameSite to cookies                        (AB-04, CB-08)
4. ONLY THEN: add credentials:'include' to all 39 frontend fetches  (AF-15, CF-04)
```

### ⛔ CONSTRAINT 2 — Do not "fix" the token generator in isolation

`genToken()` in both backends is `sha256(user_id + Date.now())` — brute-forceable in under a second
on a GPU (`AB-24`, `CB-24`). It is currently harmless **only because nothing verifies tokens.** The
moment auth middleware goes live, every account becomes takeover-able unless the token generator is
replaced in the same change. **AB-24 / CB-24 must ship together with AB-01 / CB-01.**

### ⛔ CONSTRAINT 3 — `.env` files must exist before removing DB fallbacks

`config/db.js` in both backends falls back to `root` / `admin123` / `db`. `client-backend` has **no
`.env` at all**, and `admin-backend/.env` contains **only** the three Cloudinary keys — no `DB_*`.
So those hardcoded fallbacks are the **live running configuration**, not a dead safety net.

Create both `.env` files **first**, then remove the fallbacks (`AB-06`, `CB-10`). Reversing this
breaks local dev immediately.

### ⛔ CONSTRAINT 4 — Deleting `adminDetails.js` is safe; rotating the password is the actual fix

`admin-frontend/admin/src/adminDetails.js` is **never imported anywhere** (verified: a single grep
hit, its own declaration). Deleting it will not break login. But the password inside it is the
**real production admin password** — the backend bcrypt-verifies it against the DB. **Deleting the
file does not revoke it. Rotation does.** It is also in git history, so history rewriting is
required in addition to rotation.

---

### ✅ CONSTRAINT 5 — RESOLVED (Phase 5, Slice 3) — `CF-22` shipped; the shop no longer calls the admin backend

> **Status: satisfied.** The storefront now reads its catalogue from the client
> backend, verified with the admin backend fully stopped. Kept below because the
> reasoning explains why the storefront must never call admin routes again, and
> because the production deploy still has to carry this change **with** the
> Phase 2 auth work — deploying the auth alone would still empty the shop.

Discovered 2026-08-28, while diagnosing a storefront problem that turned out to be a
dead local server. The underlying finding is real and is a **go-live blocker**.

The customer storefront fetches its entire product catalogue from the **admin**
backend (`get-all-product-details`) — that is `CF-22`. Phase 2 put every admin
route behind `authMiddleware` + `requireAdmin`. Those two facts are incompatible:

```
customer (no admin session) -> admin backend -> 401 -> result.success false -> shop EMPTY
```

Affected: `/shop` (the whole catalogue, `App.jsx:48`) and the homepage
"New Collection" section (`Homepage.jsx:137`). Bestsellers and the collections
strip are unaffected — they correctly use the client backend.

**Why nobody has noticed, twice over:**

1. **Locally**, browser cookies ignore port numbers. With the admin panel open on
   `localhost`, the storefront's call to `localhost:9032` carries the admin session
   cookie and returns 200. The machine is lending the shop admin credentials.
2. **In production**, it works because the deployed admin backend has **no auth at
   all** — `AB-01`, still live. Verified 2026-08-28:
   `GET https://pai-silks-website.onrender.com/api/get-all-product-details` with no
   cookie returns **HTTP 200 and 35 products**, including `created_at` and
   `is_new_release`. The shop works today *because the door has no lock.*

In production the two are different registrable domains (`paisilks.com` ->
`onrender.com`), so a customer has no admin cookie and no way to obtain one. The
moment the hardened backend deploys, every customer sees an empty shop — while the
owner, logged into the admin panel, sees it working perfectly.

**Therefore:** re-point the storefront onto client-backend endpoints **before or in
the same deploy as** the Phase 2 auth work. The client backend already exposes
`/api/products/new-releases`, `/api/products/:category` and `/api/:productId`
publicly, and they omit the internal fields customers should never receive.

Do **not** defer this to `INFRA-02` with the rest of the API-ownership tidy-up.
The rest of that work is hygiene; this half blocks go-live.

---

## 3. Repository map

```
pai_silks_website/
├── admin-backend/          Express 5 · MySQL · port 9032 · 15 routes · 0 authenticated
├── admin-frontend/admin/   React 19 + Vite + Tailwind + shadcn · 13 fetch calls · 0 authenticated
├── client-backend/         Express 5 · MySQL · port 9034 · 23 routes · 0 authenticated
├── client-frontend/client/ React 19 + Vite + Tailwind + shadcn · 26 fetch calls · 0 authenticated
├── pai_silks_coming_soon/  Standalone Vite landing page — NOT YET AUDITED
└── website-backend/        Stub, unused — NOT YET AUDITED
```

**Git:** repo root is `pai_silks_website/`. Remote is
`https://github.com/LikhithShivaji/pai_silks_website` — **public**.

**Route/auth reality:**

| App | Routes | Authenticated | Authorized | Rate-limited | Schema-validated |
|---|---|---|---|---|---|
| admin-backend | 15 | **0** | **0** | **0** | **0** |
| client-backend | 23 | **0** | **0** | **0** | **1** (one `parseInt`) |

---

## PHASE 0 — Secrets rotation

**No code. Do this today. Nothing else in this document matters until these two keys are dead.**

| ID | Severity | What | Action |
|---|---|---|---|
| **SEC-01** | **CRITICAL** — ⚠️ **STILL LIVE** | **Cloudinary API secret committed to a public GitHub repo.** `admin-backend/.env` is tracked in git (`git ls-files` confirms). Introduced in commit `8f8cb01 "Image url"`. Contains `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, all populated. Root cause: `admin-backend/.gitignore:16-19` is stock CRA boilerplate that ignores `.env.local` and `.env.*.local` but **not bare `.env`**. | 1. Rotate the Cloudinary API secret in the Cloudinary dashboard.<br>2. `git rm --cached admin-backend/.env`<br>3. Add `.env` + `.env.*` + `!.env.example` to `.gitignore` in all four app folders **and** create a repo-root `.gitignore` (there is none).<br>4. Purge from history (`git filter-repo` or BFG), force-push, notify anyone who cloned.<br>5. Assume the old key is compromised — audit Cloudinary usage logs. |
| **SEC-02** | **CRITICAL** | **Working production admin password committed to a public repo.** `admin-frontend/admin/src/adminDetails.js:1-3` contains `paisilks@gmail.com` / `paisilks@123`. The backend bcrypt-verifies this against `master_user`, so it opens the live admin panel. File is tracked in git. | 1. Delete `src/adminDetails.js` — it is imported by nothing, deletion is safe.<br>2. Purge from git history.<br>3. Never store credentials in frontend source again.<br>**Note:** the actual password *rotation* is **`SEC-02b`, moved to Phase 2** — it belongs with the credential/JWT work and with the production deploy, not here. Deleting the file does **not** revoke the password. |
| **SEC-03** | **HIGH** | **Production PII dump sitting on disk.** `/Users/likhith/personal-lab/pai-silks-repo/u863032788_db.sql` contains 25 real customers' names, emails, phone numbers, full postal addresses, and bcrypt hashes, plus all orders and sessions. It is one directory *above* the git root so it is **not** committed — but it is unencrypted, and the `u863032788_` prefix identifies the live Hostinger database. | Move it out of the repo tree entirely, or encrypt it. Add `*.sql`, `*.dump` to the root `.gitignore` before that file ever moves inside. Do not commit database dumps. |
| **SEC-04** | ~~MEDIUM~~ **LOW** | **Downgraded** — user confirmed the phone numbers in `admin-frontend/admin/src/RecentOrders.js:1-80` are dummy, not real customer data. Remains dead-code cleanup rather than a PII leak. | **DONE** — deleted `src/RecentOrders.js`, removed the unused import at `RecentOrders/RecentOrders.jsx:4`, and deleted the dead `components/OrderedProducts/` folder (its only other consumer). No history purge needed. |

---

## PHASE 0.5 — API base URL configuration ✅ DONE

**Why this had to come before Phase 1:** both frontends had the Render production
URLs hardcoded in 39 places with no env layer. Running them locally meant the
browser bypassed `localhost:9032/9034` entirely and hit **live production** — so
nothing was testable locally, and clicking around the local admin panel mutated
real customer data.

**What was done:**

| | |
|---|---|
| New | `src/config/api.js` in both frontends, exporting `ADMIN_API` + `CLIENT_API` from `VITE_*` vars with `localhost` fallbacks |
| New | `.env` (gitignored), `.env.production` (committed), `.env.example` (committed) in both frontends |
| Changed | 39 URL literals across 16 files → template strings (14 admin, 25 client) |
| Removed | dead `const API_BASE` at `AdminHomePage.jsx:36` |
| Changed | both frontend `.gitignore` files — ignore `.env`/`.env.*`, keep `.env.production` + `.env.example` tracked |
| New | `DEPLOYMENT.md` — documents build-time substitution, why `.env` is never uploaded to Hostinger, and where backend env vars actually live |

**Verified:** both apps build clean; `dist/` contains the Render URLs and zero
`localhost` occurrences; `git check-ignore` confirms `.env` ignored and the other
two tracked.

**Deliberately unchanged (pure refactor, zero behaviour change):**
- Every call still targets the same backend it did before, including the
  cross-calls (`AF-07`, `CF-22`). Re-pointing is Phase 5.
- No `credentials: 'include'` added — that is Phase 2.3, blocked behind the CORS
  allowlist. See [CONSTRAINT 1](#2-hard-ordering-constraints).

**Closes:** `AF-07`, `CF-49` · **Partially:** `AF-36` (repo-root and both backend
`.gitignore` files still outstanding under `SEC-01`).

---

## PHASE 1 — Stop the bleeding

Small, safe, high-impact. These stop active money loss and active over-billing. **None of them
requires the auth rewrite.**

| ID | Severity | One-line summary |
|---|---|---|
| **CF-01** | CRITICAL | Every order is written to the DB as `payment_status: "Paid"` with ₹0 collected. **One-line fix.** |
| **CF-02** | CRITICAL | Duplicate cart rows → customers charged N× what the UI shows. |
| **CF-03** | HIGH | ₹99 shipping exists only in JSX → merchant under-collects ₹99 on **100% of orders**. |
| **CF-07** | HIGH | `order_status` vs `status` name mismatch → every order stored with `status = NULL`. |
| **CF-10** | HIGH | Unguarded `JSON.parse` + no ErrorBoundary → one corrupt localStorage key permanently bricks the site. |
| **AB-02 / CB-07** | HIGH | CORS `origin: true` → explicit allowlist. |
| **AB-04 / CB-08** | HIGH | Add `secure` + `sameSite` to cookies. |
| **AB-05 / CB-05** | HIGH | Cookie `maxAge` unit bug → cookies currently expire in the year 238,581. |
| **AB-03 / CB-11** | HIGH | Add `express-rate-limit` to login and signup. |
| **AB-19 / CB-19** | MEDIUM | Add `helmet` + `app.disable('x-powered-by')`. |
| **AB-18 / CB-13** | MEDIUM | Add a global error handler; set `NODE_ENV` (stack traces are currently returned to clients). |
| **AF-03 / AF-14** | MEDIUM | Strip 18 PII-leaking `console.log` calls; delete mock data with real phone numbers. |

---

## PHASE 2 — Authentication & authorization

**The single largest batch. Closes ~25 findings at once.** Respect [CONSTRAINT 1](#2-hard-ordering-constraints).

### 2.—1 Session policy — DECIDED

User decisions, 2026-08-24:

| | Customer | Admin |
|---|---|---|
| Max concurrent devices | **2** | **2** |
| Session lifetime | **7 days** | **1 day** |

**Eviction rule:** a 3rd login does **not** get rejected — it evicts the
**oldest** active session (sets `status = 'LOGOUT'`). Rejecting the 3rd device
would strand a customer who cleared cookies or changed browser with no way back
in until something expired.

**Token model.** JWT lifetime equals session lifetime; the `session` table row
is the revocation mechanism.

```
authMiddleware on every request:
  1. jwt.verify()                        <- signature + expiry, no DB hit
  2. session row exists AND status='ACTIVE'   <- enables instant revocation
  3. master_user.is_delete = 0                <- CB-21
```

Chosen over a short-JWT + refresh-token design because device eviction and
logout both require **instant** revocation, which a stateless JWT cannot give.
Cost is one indexed `session` lookup per request — negligible at this scale, and
the correct trade when the alternative is a logged-out device staying valid for
up to an hour.

`appDefines.expiryTime` is restructured accordingly: the existing
`sessionExpiryTime` (1 day) / `tokenExpiryTime` (1 hour) split no longer
reflects how sessions actually work.

---

### 2.1 Backend — build the auth layer

**Both backends** (`jsonwebtoken@9` is already installed in both and **never imported** — use it):

```
1. Add JWT_SECRET to both .env files (see CONSTRAINT 3 — create the .env files first)
2. Replace utils.genToken() with jwt.sign({ user_id, role_id }, JWT_SECRET, { expiresIn: '1h' })
   — this fixes AB-24 / CB-24 and MUST ship in the same change (CONSTRAINT 2)
3. Write middlewares/authMiddleware.js:
     - read the token (httpOnly cookie)
     - jwt.verify()
     - look up the session row; reject unless status = 'ACTIVE' AND not expired
     - reject if master_user.is_delete = 1   (fixes CB-21)
     - attach req.user = { user_id, role_id }
4. admin-backend: write middlewares/requireAdmin.js — reject with 403 unless req.user.role_id === 0
5. Apply both to every route (router.use()) — 15 admin routes, 23 client routes
6. Add a real logout endpoint to both (fixes AB-07 / CB-13-logout):
     - set session.status = 'LOGOUT', clear cookies server-side
7. Token renewal / token_created_time — see AB-41. (This step previously cited
   AB-11, which is a different finding entirely: non-scalar JSON corrupting SQL
   params. The renewal issue had no register row until now.)
8. Decide and implement multi-session policy (fixes AB-12 / CB-30)
```

### 2.2 Backend — kill the IDOR

In **every** client-backend handler that takes a `user_id` or `order_id`, compare it against
`req.user.user_id` from the verified token and reject with `403` on mismatch. Better: **stop
accepting `user_id` from the client entirely** and read it only from the token.

Affected handlers (all in `client-backend/src/controllers/customerController.js`):

| Line | Handler | Currently leaks / allows |
|---|---|---|
| 182 | `getUserDetails` | Any user's name, email, phone, **full postal address** |
| 381 | `getWishlist` | Any user's wishlist |
| 462 | `wishlistCount` | Any user's wishlist count |
| 509 | `getCart` | Any user's cart |
| 646 | `getOrderById` | Any order's total, address, payment status |
| 676 | `getOrdersByUser` | Any user's full order history |
| 345 | `addToWishlist` | Write to any user's wishlist |
| 407 | `removeWishlist` | Delete from any user's wishlist |
| 484 | `moveWishlistToCart` | Mutate any user's cart |
| 530 | `updateCartQuantity` | Mutate any user's cart |
| 541 | `removeFromCart` | Delete from any user's cart |
| 554 | `addToCart` | Write to any user's cart |
| 581 | `createOrder` | **Place an order as any user, billed to them, wiping their cart** |
| 717 | `addOrderItem` | **Attach any product at any price to any order** |

`user_id` values are sequential (`master_user` AUTO_INCREMENT = 26). Full customer PII scrape in 25
requests, unauthenticated.

### 2.0 Credential hardening — `SEC-02b`, `DB-08`, `CB-28` (partial)

Moved here from Phase 0. Password hashing belongs with the credential layer, and
the production half has to ship alongside the code + DB deploy rather than on its
own.

```
1. Add a password-hashing helper (bcrypt cost 12) used by BOTH:
     - the admin password rotation below
     - the signup path (the code-side half of CB-28, Phase 3)
   The plaintext must never reach a shell history, a transcript, or this repo —
   read it from a hidden prompt.

2. SEC-02b — rotate the admin CREDENTIALS.  ⏳ PENDING — owner will do this later.

   Scope widened 2026-08-24: the owner wants the admin EMAIL changed too, not
   just the password. Current identity is `admin123@gmail.com` / the hash that
   was shared with two test accounts (DB-08).

   Both halves are still outstanding:
     - [ ] new email        (currently admin123@gmail.com)
     - [ ] new password     (currently the DB-08 shared hash, cost 10)
     - [ ] apply to LOCAL
     - [ ] apply to Hostinger production   <- separate DB; local does not affect it

   Password:  node scripts/set-password.js <new-email>
              prompts hidden, prints the UPDATE. Uses cost 12 automatically.

   Email — three things to get right:
     a) `master_user.pri_email` is UNIQUE, so the new address must not collide.
     b) `session.pri_email` is a DENORMALISED COPY. Changing the email without
        touching it leaves session rows carrying the old address. Nothing in
        the Phase 2 auth path reads it — authMiddleware joins on user_id — so
        it will not break login, but it silently rots. Simplest correct move:
        change the email and DELETE that user's session rows in the same
        statement, forcing a fresh login.
     c) The `pri_email` cookie set at login will hold the old value until the
        admin logs in again. Harmless (nothing authorises on it) but another
        reason to clear sessions.

   Do the email and password together, in one transaction, on both databases.

3. DB-08 — master_user rows 1, 2, 3 share an identical bcrypt hash (a seeded or
   shared password). Force-reset all three.

4. Raise the bcrypt cost from 10 to 12 in the signup path (customerController.js:21).
```

> **Deploy coupling:** the production password change must go out **with** the
> code + DB migration, not before. Rotating production early while the old code is
> still deployed is safe for login, but the user has chosen to move code and
> database together to avoid a partially-migrated production state. Respect that.

---

### 2.3 Frontend — after 2.1 and 2.2 are live

```
1. Add credentials: 'include' to all 39 fetch calls (13 admin + 26 client)
2. Remove user_id from every request body/path/query — the server reads it from the token
3. Stop writing user_id / admin_auth to localStorage as an identity signal
4. admin-frontend: replace the ProtectedAdminRoute localStorage check with a real
   /api/verify-token call  (AF-02)
5. client-frontend: add a PrivateRoute wrapper around /my-orders, /my-profile, /checkout  (CF-08)
6. admin-frontend: wire the Logout button  (AF-06)
7. Fix the AdminLogin success condition — currently the first login always appears to fail  (AF-16)
```

---

## PHASE 3 — Input validation & error handling

Install `express-validator` (or `zod`) in both backends — **neither has any validation library.**

**Minimum validation set:**

| Target | Rule |
|---|---|
| `status` (order) | See the fulfilment-status decision immediately below. |

### Order fulfilment status — DECIDED (owner, 2026-08-24)

```
Pending → Confirmed → Packed → Shipped → Out for Delivery → Delivered
```

Six states, in that order. This becomes the enforced enum on
`PUT /api/update-order-status` and the backing value for shipment tracking.

**Carrier context:** the admin ships via **DTDC** and **India Post**. Once a
carrier API is wired up, `Shipped` / `Out for Delivery` / `Delivered` will be
driven by carrier events rather than set by hand. That has two implications
for Phase 4:

- `orders` needs a **carrier** column (`DTDC` | `India Post`) alongside the
  `consignment_number` already planned in `DB-09` — you cannot query the right
  API without knowing which one shipped it.
- The enum above is the *internal* vocabulary. Carrier APIs return their own
  strings, so the eventual integration needs a mapping layer, not a direct
  write-through. Keep the internal set stable.

**No `Cancelled` and no `Returned` — deliberate.** Raised and declined by the
owner on 2026-08-24: the business does not accept returns or order
cancellations, so those states have no meaning here. The enum is exactly the
six above and is a strictly forward-only progression.

Documented consequence, not an objection: an order that cannot be completed for
an operational reason stays at whichever state it reached. If that ever needs
representing, it is an enum change plus a migration, not a code change.
| `payment_status` | **Never accept from the client.** Server-assigned only. |
| `quantity` | `isInt({ min: 1, max: 100 })` + must not exceed available stock |
| All `:id` params | `isInt({ min: 1 })` — currently no numeric coercion anywhere |
| `regular_price` / `selling_price` | `isFloat({ min: 0 })`, and `selling_price <= regular_price` |
| `stock_qty` | `isInt({ min: 0 })` |
| `pri_email` | `isEmail()` + `normalizeEmail()` + `maxLength(100)` |
| `password` | `isLength({ min: 8, max: 72 })` — the max matters, bcrypt truncates silently at 72 bytes |
| `phone_number` | `matches(/^[0-9]{10}$/)` (allow a `+91` prefix if desired) |
| `user_name` | `isLength({ max: 50 })` — matches the column width |
| All body fields | **Reject non-scalar types.** Objects/arrays currently reach `mysql2` params and mangle the query shape (`AB-11`, `CB-12`). |

**Error handling — apply to both backends:**

```
1. Replace every `res.status(500).json({ message: error.message })` with a generic message.
   admin-backend: 19 sites + utils.js:16
   client-backend: 19 sites (lines 171,201,219,238,257,287,316,337,455,476,501,520,534,
                             545,575,637,670,711,737)
2. Add a global error-handling middleware to both (currently none → Express dev mode returns
   full stack traces in HTTP responses).
3. Set NODE_ENV=production in deployment.
4. Fix the `appConstants` ReferenceError in both login managers — it is used but never imported,
   so the catch block destroys the original error.
5. Stop console.error-ing raw mysql2 Error objects — they contain the failing SQL *and bound
   parameter values*, i.e. customer PII in stdout logs.
```

---

## PHASE 4 — Database integrity

### 4.1 Schema migrations

The database has **exactly one foreign key** in the entire schema (`session.user_id`). Everything
else is unconstrained.

| ID | Fix |
|---|---|
| **DB-01** ✅ **DONE (Slice 1)** — 11 foreign keys added (1 → 12 total) → `migrations/005_referential_integrity.sql`. CASCADE on `cart`/`wishlist`/`product_images`/`product_stock`; RESTRICT on `orders`/`order_items`/`payments`/`shipments` so a sales record can never vanish as a side effect. **Verified:** 6 kinds of garbage row now rejected, deleting a customer with orders is blocked, deleting a user without orders correctly cascades their cart and wishlist. Applied **local only** — ⚠️ must run on Hostinger. | Add FKs: `cart.user_id`→`master_user`, `cart.product_id`→`product`, `wishlist.*`, `orders.user_id`, `order_items.order_id`→`orders`, `order_items.product_id`→`product`, `product_images.product_id`, `product_stock.product_id` |
| **DB-02** ✅ **DONE** | Add `UNIQUE KEY (user_id, product_id)` on `cart`. **This is the schema half of the CF-02 over-billing bug.** (`wishlist` already has this; `cart` does not.) → `migrations/001_cart_unique_user_product.sql`. Applied to **local only**; ⚠️ **must be run against Hostinger production at deploy time.** |
| **DB-03** ✅ **DONE (Slice 1)** — `UNIQUE KEY (product_id)` on `product_stock`. Local had no duplicates; this makes it structural. Verified a duplicate insert is rejected. | Add `UNIQUE KEY (product_id)` on `product_stock` — currently multiple stock rows per product are possible and are mishandled (`CB-16`). |
| **DB-04** ✅ **DONE (Slice 1)** — 2 NULL-status rows backfilled to `Delivered` (both `Paid` and months old, matching siblings 10/11 from the same period), then `status` set `NOT NULL DEFAULT 'Pending'`. ⚠️ Production may hold different NULL rows — the migration flags this as a judgement call on real sales data. | Backfill `orders.status` where it is `NULL` (rows 12 and 13 in production, caused by `CF-07`). Then set `NOT NULL`. |
| **DB-05** | Confirm `master_user.pri_email` is `UNIQUE` (it appears to be — `ER_DUP_ENTRY` fires). Keep it, but stop leaking existence through the 409 response (`CB-10-enum`). |
| **DB-06** | Normalise `product.category`. It is a free-text string column independent of the `category` table, so soft-deleting a category has **no effect on products** and the two endpoints disagree permanently (`AB-31`). Make it `category_id` with an FK. |
| **DB-07** ✅ **ALREADY SATISFIED** — checked `information_schema.STATISTICS`: every FK and dashboard-join column already carried an index. No new indexes needed. | Add indexes on all FK/lookup columns used in the dashboard joins. |
| **DB-08** ✅ **DONE (Slice 6)** | Rows 1, 2 and 3 shared one bcrypt hash — and **row 1 is the admin**, so the admin password was also two customer test accounts' password. Owner authorised deletion 2026-08-24 (all data dummy, site not public). `migrations/003_remove_shared_password_accounts.sql` deletes rows 2 and 3 (`customer1@gmail.com`, `abcd234@gmail.com`) plus their session rows — verified beforehand to have 0 orders, 0 cart, 0 wishlist. They were also the only `role_id = 1` accounts, an undocumented legacy role; roles are now cleanly 0 = admin, 2 = customer. **Verified after applying:** 24 → 22 users, **0 shared-hash groups**, 0 orphan rows. Applied to **local only** — ⚠️ must also run on Hostinger. ⚠️ **The admin password itself is still the compromised one** — rotation is `SEC-02b`, which needs the owner to choose a password. |
| **DB-09** | Add `consignment_number VARCHAR(50)` **and `carrier VARCHAR(20)`** to `orders`. The admin ships via **DTDC and India Post** (owner, 2026-08-24), so tracking needs to know which carrier handled each order — the consignment number alone is not enough to query the right API. See [Deferred](#13-deferred-work). |
| **DB-10** ✅ **DONE** | `session.token` was `VARCHAR(255)`, sized for the old 64-char sha256 digest. A real JWT measures **243 characters** — it fit, but with 12 characters of headroom. One extra claim would overflow, and in non-strict SQL mode MySQL **silently truncates**, which breaks `jwt.verify()` and logs users out at random. Widened to `VARCHAR(512)` → `migrations/002_session_token_widen.sql`. Applied to **local only**; ⚠️ **must run against Hostinger before the Phase 2 backends go live.** |

### 4.2 Transactions

Neither backend uses transactions anywhere — `grep` for `getConnection|beginTransaction|commit|rollback`
returns **zero** hits across both.

| ID | Fix |
|---|---|
| **CB-06** ✅ **DONE (Slice 3)** — `createOrder`'s four writes wrapped in one transaction. **Verified by forcing a failure at `reduceStock`:** no order row, no order_items, stock unchanged, and the cart correctly NOT cleared. Previously that same failure created the order, half-reduced stock, and left the cart full so the customer would retry and order twice. | Wrap the whole of `createOrder` (`customerController.js:579-639`) in `BEGIN`/`COMMIT`/`ROLLBACK`: create order → insert items → reduce stock → clear cart. Currently a failure at item *k* leaves the order row, items 1..k, stock decremented for 1..k-1, and the cart **not** cleared. |
| **AB-14a** ✅ **DONE (Slice 3)** — product + stock insert wrapped. **Verified:** forcing the stock insert to fail leaves no product row at all. This is the bug that produced the 29 stranded products repaired in Slice 2. | Wrap `productManager.createProduct` (`:14-20`) — product INSERT then stock INSERT. Stock failure currently leaves a product with no `product_stock` row. |
| **AB-14b** ✅ **DONE (Slice 3)** — the delete-then-insert image swap wrapped, and uploads moved OUTSIDE the transaction (an upload cannot be rolled back, and a long transaction holds one of only 10 pool connections). **Verified:** forcing the insert to fail leaves the product's existing 4 images intact. Previously it lost every image permanently. | Wrap `productManager.updateProduct` (`:60-64`) — it does `deleteImagesByProductId` **then** `insertImages`. If the insert fails, **the product loses all its images permanently**, and per `AB-10` the Cloudinary originals were already orphaned. This is destructive and non-recoverable. |
| **AB-15** ✅ **DONE (Slice 4)** — login's read → evict → insert wrapped in a transaction with `SELECT ... FOR UPDATE` on the **master_user** row. **Verified before:** 6 simultaneous logins produced **4** active sessions against a cap of 2. **After:** all 6 succeed, exactly **2** active. Applied to both services. **Design note:** the lock is on `master_user`, not `session` — `FOR UPDATE` on `session` locks only rows that already match, so a user with zero active sessions would have nothing locked and the race would survive. | Fix the login TOCTOU: `getAdminLastSessionByEmail` then `insertNewSession` with no lock. Two concurrent logins both insert; the losing row stays `ACTIVE` forever with no way to revoke it. |
| **AB-15b** ✅ **DONE (Slice 4)** — compare-and-swap on `stock_qty`. **Verified before:** A sets 100, B sets 200 concurrently → result 200, A's change silently gone. **After:** one succeeds, the other gets **409** *"Stock was changed by someone else while you were editing."* **Why `stock_qty` and not `updated_at`:** `updated_at` is a 1-second-resolution TIMESTAMP — two edits in the same second share a value, verified — so it cannot distinguish them. Using the value itself needs no schema change. Reads `affectedRows`, not `changedRows`, so setting the same value is a valid no-op rather than a false conflict. Frontend sends `expected_stock_qty` from what the form loaded. | `updateProductStock` is an absolute `SET stock_qty = ?` — concurrent admins silently overwrite each other. Change to a relative `stock_qty = stock_qty + ?`, or use optimistic locking. |

### 4.3 Soft-delete enforcement

`is_deleted` / `is_delete` is applied inconsistently. Every one of these is a bypass:

| ID | Location | Missing filter |
|---|---|---|
| **CB-21** ✅ **DONE (Slice 4)** — `is_delete` checked in both `validateCustomerLogin` and `authMiddleware` | `client-backend/sqlQueries.js:16, 21` | Login does not check `master_user.is_delete` → **soft-deleted/banned users can still authenticate.** |
| **CB-08s** ✅ **DONE (Slice 5)** | `getCart` | Fixed — `AND p.is_deleted = 0` on the join. Verified: a soft-deleted product disappears from the cart. Owner chose the silent drop over a "no longer available" notice; the notice is logged as a follow-up. |
| **CB-08s** ✅ **DONE (Slice 5)** | `getWishlist` | Fixed — same join guard. Verified. |
| **CB-08s** ❌ **WON'T FIX — the finding was wrong** | `getOrderItems` | Adding `p.is_deleted = 0` here would be a BUG. This query lists what a customer actually bought; filtering it would make a soft-deleted product **vanish from their past order**, showing fewer items than they paid for. Historical records must show history. Verified explicitly: after deleting a product it still appears in order history. |
| **AB-12s** ✅ **DONE (Slice 5)** | `updateProduct` | Fixed — `AND is_deleted = 0`, plus the dbOp now returns `affectedRows` and the manager throws 404 on 0. That second half matters: without it this would repeat AB-13, where a guard existed but nobody read its result. **Verified:** editing a deleted product returns 404 and the row is unchanged; live products still edit normally. |
| **AB-12s** ✅ **MOSTLY MOOT** | `insertImage` / stock writes | The **existence** half was already fixed in Slice 1 — `fk_product_images_product` and `fk_product_stock_product` mean a nonexistent `product_id` is now rejected by the database. The remaining gap (attaching an image to a *soft-deleted* product) is reachable only from the admin panel, which no longer lists deleted products, and `updateProduct` now 404s on them. Left as-is rather than adding a lookup on every image insert. |
| **AB-17b** ✅ **DONE (Slice 5)** | `getBestSellers` | Fixed — `AND p.is_deleted = 0`. The CLIENT's version already filtered; the two services disagreed. Verified: a deleted product drops out of the admin bestseller list while its past orders stay visible. |

---

## PHASE 5 — Correctness bugs

Not security, but each one breaks a real user journey or corrupts data. Full detail in the register.

**Money / data correctness:**
`CF-03` (₹99 phantom shipping) · `CF-07` (status NULL) · `CF-13` (guest-merge quantity never
persisted, yields `NaN`) · `AB-16` (order totals double-counted by non-1:1 LEFT JOINs) ·
`AB-17` (four broken dashboard aggregations) · `AB-13` (order-status update reports success for
nonexistent orders) · `CB-24b` (cart items silently dropped, then cart wiped) ·
`CB-05` (`undefined` overrides column DEFAULTs — already happened in production)

**Journeys that are 100% broken:**

> ⚠️ **The IDs in this paragraph were wrong** and are corrected here. It named the
> update-profile bug `CF-04` (that is the `credentials:'include'` finding) and the
> checkout-phone bug `CF-06` (that is update-profile). The register was right; this
> summary was not. The mislabelling is what let `CF-06` get ticked off against
> `CF-09`'s fix while still being broken — see its register row.

`CF-06` ✅ **DONE (Slice 1)** (`PUT /api/update-profile` — **route did not exist**; profile
editing was a permanent no-op) · `CF-09` ✅ **DONE (Phase 3, Slice 6)** (checkout phone was
always `"9999999999"` — three stacked defects; **you could not phone any customer about any
order**) · `AF-16` ✅ **DONE (Phase 2, Slice 5)** (first admin login always appeared to fail —
required pressing the button twice) · `CF-08` ✅ **DONE (Slice 1)** (no 404 route → typo'd URLs
were blank pages; "Forgot Password?" linked to a route that did not exist) ·
`AF-17` ✅ **DONE (Slice 1)** (**case-mismatched import broke any Linux/CI build**)

**Crash-on-undefined — client-frontend:** ✅ **DONE in Phase 1 Slice 4** (`CF-10`). One
ErrorBoundary around `<AppRouter />` plus a guarded localStorage read converted all seven
blank-page outages (`CF-C-F1`..`F7`) into a recoverable page.

---

### `AF-C-FIX` — Crash-on-undefined, admin-frontend · HIGH · ✅ **DONE (Phase 5, Slice 5)**

> Scheduled here after being flagged as a gap during Phase 1. The original plan named the
> admin crashes but only ever prescribed a fix for the client, so admin would have finished
> all seven phases with zero crash protection.

**This is NOT simply "the same ErrorBoundary again."** The two apps fail differently:

| | client-frontend | admin-frontend |
|---|---|---|
| Symptom | blank white page — obvious | **silently swallowed**, page just looks empty |
| Caught by a boundary? | yes | **only some of them** |

An ErrorBoundary alone would **not** fix the worst admin case. `AF-C-F1`
(`AdminHomePage.jsx:138`) throws inside `normalizeOrders`, but the surrounding `.catch` at
`:124` eats it before React ever sees it — so the order list silently never loads and the
dashboard just appears empty, with no error anywhere. Admin needs **both** a boundary and
per-site guards.

✅ **DONE — Phase 5, Slice 5.** All three parts shipped, plus two corrections to this plan.

⚠️ **Correction 1 — `AF-C-F1` was NOT reachable as described.** This section called it "the worst;
hides all orders", but `getAllOrderData` used `JOIN order_items` (inner), so an order with no items
was excluded from the result entirely and `product_list` was always present. The guard went in
anyway, because part of this slice made it reachable — see below.

⚠️ **Correction 2 — the inner join hid a worse problem than the crash.** An order with zero items was
**INVISIBLE to the admin**: it exists, the customer may have been charged, and the operator could not
find it. Changed to `LEFT JOIN` (owner approved) so such orders surface. They can no longer be
*created* — `CB-06` wrapped checkout in a transaction, verified: a crash after the order row is
written now rolls it back, where the old code left the row behind — but **production still runs the
pre-transaction code and may already hold some.** Guards shipped before the join change, in that
order, so a surfaced order renders safely instead of taking the list down.

**What shipped:**
- `components/ErrorBoundary.jsx` — new, mounted in `main.jsx` around the whole router. The admin app
  had **none** (verified: zero matches for `ErrorBoundary`/`componentDidCatch`/`getDerivedStateFromError`).
  Deliberately not a copy of the storefront's: that one is customer-worded and offers to clear the
  saved cart, which is meaningless to an operator. This one shows the error message, because the
  person reading it is the one who has to report it.
- **The swallowed order fetch** — was `.catch(console.error)`, so any failure left `orders` as `[]`
  and the dashboard looked like a shop with no orders. Now checks `res.ok` **before** parsing, maps
  401 to *"Your session has expired"*, and renders an inline error with a **Retry** button (owner
  chose option A). A boundary cannot fix this: the throw happens inside a promise chain, so React
  never sees it.
- **Guards:** `product_list ?? []`; `products[0]?.name` (a null first element threw
  `Cannot read properties of null`, verified); `Number.isFinite` checks before `Intl.format` (verified:
  `Intl.format(NaN)` renders the literal **₹NaN** rather than throwing); `formatDate` /`formatMoney`
  helpers in `DisplayOrderPage` — verified `new Date(undefined)` → *"Invalid Date"* and, worse,
  `new Date(null)` → **1/1/1970**, which looks like a real order date. Also guarded the second
  `order.product.map` at `:213`, which lacked the `Array.isArray` check its sibling 85 lines above had.

⚠️ **Self-inflicted bug caught during this slice:** a **backtick** inside a SQL comment silently
terminated the JS template literal, truncating `getAllOrderData` after `FROM orders o` and dropping
every JOIN. `node --check` passed (the remainder still parsed as JS) and MySQL reported the
misleading `Unknown column 'oi.order_item_id'`. Fixed, a warning left in the file, and both
`sqlQueries.js` files swept for the same pattern — no others.

**Verified:** an itemless order is now visible with `items=0` and all 5 orders normalise without
throwing; an unauthenticated request yields 401 → the expired-session message plus Retry rather than
an empty dashboard; no unguarded `.map`/`[0].`/`new Date(` sites remain in the admin components; both
frontends build.

Three parts:

```
1. Add an ErrorBoundary to admin-frontend/admin/src/main.jsx
   Reuse the component from client-frontend/src/components/ErrorBoundary.jsx.
   Covers the render-phase crashes: AF-C-F2 (AddProduct.jsx:305),
   AF-C-F3 (DisplayOrderPage.jsx:192), AF-C-F4 (UpdateProduct.jsx:58-60).

2. Add null guards at the SWALLOWED sites — a boundary cannot reach these:
   AF-C-F1  AdminHomePage.jsx:138   o.product_list.map(...)      <-- worst; hides all orders
   AF-C-F5  AdminHomePage.jsx:91    data.data.map(...)
   AF-C-F6  AdminHomePage.jsx:120   normalizeOrders(res.data)
   Stop the surrounding .catch blocks from silently discarding real errors.

3. Fix the ₹NaN money displays and the date/element-type guards:
   AF-C-F7..F11  DisplayOrderPage.jsx:218, RecentOrders/Columns.jsx:162-166,
                 DashBoard.jsx:123-127            -> renders "₹NaN" to the admin
   AF-C-F12      DisplayOrderPage.jsx:172         -> renders "Invalid Date"
   AF-C-F13      RecentOrders/Columns.jsx:69      -> null first element throws
```

> `DashBoard.jsx:11-16, 21-23` is the one place in the admin app that already does this
> correctly — default param `orders = []` plus optional chaining. Use it as the pattern.
>
> Note `AF-C-F7..F11` and `AF-C-F13` previously also listed `OrderedProducts/Columns.jsx`;
> that folder was deleted in Phase 0, so those sites no longer exist.

---

## PHASE 6 — Code quality & hygiene

Batch at the end. Full list in [DEP-*](#dependencies--tooling--dep) and the LOW rows of each register.

Highlights: both backends are **Create-React-App projects** with `react`, `react-dom`,
`react-scripts@5.0.1`, `@testing-library/*` and a `public/index.html` shipped into a production
server (~800 of 913 `node_modules` entries are frontend tooling) · both have `bcrypt` **and**
`bcryptjs` installed · both have the squatted `crypto@1.0.1` npm placeholder · both have two
competing lockfiles · `nodemon` in `dependencies` · 19 of 20 CSS files in client-frontend are dead ·
8 unused dependencies in client-frontend · `npm run lint` fails in both frontends · a developer's
personal ngrok hostname is committed in `client-frontend/vite.config.js:16`.

---

## 11. Full findings register

---

### Admin backend — `AB-*`

`admin-backend/src/` unless stated otherwise.

#### CRITICAL

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **AB-01** ✅ **DONE (Slice 5)** — `router.use(authMiddleware, requireAdmin)` guards the whole router, so new routes are protected by default. Verified all 15 return 401 anonymously, including `DELETE /api/delete-product/1` | `middlewares/authMiddleware.js` (0 bytes); `routes/adminRoutes.js:8-42` | **Zero authentication on all 15 routes.** The middleware file is empty and `grep -rn "authMiddleware" src` returns zero hits. No route has any guard. `GET /api/get-order-detils` dumps every customer's name, shipping address, payment method and payment status to any anonymous caller. `DELETE /api/delete-product/:id`, `PUT /api/update-order-status`, `POST /api/create-product` all succeed via plain `curl`. | Implement per Phase 2.1. Apply `authMiddleware` + `requireAdmin` via `router.use()`. | TODO |
| **AB-02** | `server.js:10-15` | `cors({ origin: true, credentials: true })` — reflects **any** `Origin` with credentials allowed. | Replace with an explicit allowlist array of the admin frontend origins only. | **DONE** — env-driven allowlist via `CORS_ORIGINS`, defaulting to the two local frontends. Both frontends are allowed because both call this service (`CF-22`). Unknown origins get no CORS headers (not a 500) and are logged. **Verified:** allowed origins pass, `evil.example.com` and stray ports blocked, `CORS_ORIGINS` override honoured. ⚠️ **Must be set in Render at deploy or the live site is blocked.** |
| **AB-03** | `server.js`; `controllers/adminController.js:14` | **No rate limiting anywhere.** `express-rate-limit` is not in `package.json` and not in `node_modules`. `/api/admin-login` accepts unlimited attempts. Combined with `AB-19e` (timing enumeration) this is a fully open brute-force target. | `npm i express-rate-limit`; 10 attempts / 15 min / IP on login. Also rate-limit the upload routes (see `AB-09`). | **DONE** — `express-rate-limit` 8.6.2. `loginLimiter`: **5** failed attempts / 15 min (tighter than the plan's 10 — there is only one admin account, so a legitimate user has no reason to fail 5 times). `writeLimiter`: 100 req / 15 min across all `/api` routes, capping the damage rate on the still-unauthenticated write endpoints and the 50MB Cloudinary upload (`AB-09`). `app.set('trust proxy', 1)` in production so Render's reverse proxy does not collapse every client to one IP. **Verified:** 5 failures then 429. |
| **AB-09** | `routes/adminRoutes.js:10-14, 37-40`; `middlewares/cloudinaryUpload.js:22` | **Unauthenticated 50 MB-per-request upload directly into your paid Cloudinary account.** `upload.array('images', 10)` × `fileSize: 5MB`, with no auth, no rate limit, and no total-request cap. `CloudinaryStorage` uploads to Cloudinary **before** the controller runs, so even a request that later 400s has already burned storage and bandwidth. Trivial cost-inflation DoS. | Auth (`AB-01`) + rate limit + reduce the file/size caps + validate before upload. | TODO |

#### HIGH

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **AB-04** | `utils/utils.js:33` | `res.cookie(key, value, { maxAge, httpOnly: true })` — no `secure`, no `sameSite`, no `path`, not signed. Cookies travel in cleartext over HTTP and are sent on cross-site requests (CSRF). | ~~`sameSite: 'strict'`~~ — **the plan was wrong here.** `admin.paisilks.com` → `*.onrender.com` is cross-site, so `'strict'` or `'lax'` means the browser never sends the cookie and auth silently fails in production while passing every local test. | **DONE** — `httpOnly` + `secure` (production only) + `sameSite: 'none'` in production / `'lax'` in dev + `path: '/'`. **Verified:** production login emits `HttpOnly; Secure; SameSite=None`; dev emits `HttpOnly; SameSite=Lax` with no `Secure`. CSRF now rests on the CORS allowlist; **revert to `'lax'` at `INFRA-01`.** |
| **AB-05** ✅ **DONE** — verified `Max-Age=86400` (was 7.46e15) | `controllers/adminController.js:98-102`; `utils/utils.js:49` | **Cookie `maxAge` unit bug — cookies expire in the year ~238,000.** `convertDaysToMsec(expiryTime)` is applied to `appDefines.expiryTime.sessionExpiryTime`, which is **already milliseconds** (`1000*60*60*24` = 86,400,000). `86,400,000 × 86,400,000` = 7.46 × 10¹⁵ ms. It stays just under the `Date` ceiling so **no exception is thrown** — it silently issues permanent `session_id`, `role_id`, `pri_email` cookies. | Remove the `convertDaysToMsec` call; pass the ms value directly. Audit `appDefines.js:7` naming so this cannot recur. | TODO |
| **AB-06** | `config/db.js:6-8` | Hardcoded fallbacks `root` / `admin123` / `db`. **`.env` contains only the three Cloudinary keys — no `DB_*` at all — so these fallbacks are the live running config.** | Per [CONSTRAINT 3](#2-hard-ordering-constraints): create `.env` with `DB_HOST/USER/PASS/NAME/PORT`, `NODE_ENV`, `PORT`, `JWT_SECRET`, **then** replace fallbacks with `throw new Error('DB_PASS is required')`. | **DONE** — `.env` populated with all `DB_*` (Cloudinary keys preserved); fallbacks replaced with a `required()` helper that throws a actionable message. Verified: boots normally with `.env`, refuses to boot without `DB_PASS`. `JWT_SECRET` deferred to Phase 2. |
| **AB-07** ✅ **DONE (Slice 2)** — `POST /api/logout` added, scoped to the owning user | codebase-wide | **No logout endpoint and no session-invalidation path.** `SESSION_LOGOUT` is written in exactly one place — `adminAuthManager.js:50-54`, the *expiry* branch of login. A session can only be terminated by logging in again after it has already aged out. Combined with `AB-05`, a stolen `session_id` cookie never expires and is unrevocable. | Add `POST /api/logout`: set `session.status = 'LOGOUT'`, `logout_date_time = NOW()`, clear all cookies. | TODO |
| **AB-08** ✅ **DONE (Slice 5)** — `requireAdmin` reads `role_id` from the DB row, never the JWT claim or the unsigned cookie. Verified: a validly-signed token forging `role_id:0` on a customer session got **403**, and it was logged | codebase-wide | **No role/authorization check exists.** `role_id` appears only at `constants/cookieKeys.js:5`, `adminLoginManager.js:29`, `adminController.js:85-86` — all **writes**. It is never read or verified. Even with auth in place there would be no admin check. | Implement `requireAdmin` (Phase 2.1 step 4). Read `role_id` from the verified token, **never** from a client cookie. | TODO |
| **AB-10** ✅ **DONE (Phase 5.5, Slice 3)** — **the double upload is real and was verified at the source**: `multer-storage-cloudinary/lib/index.js:108` sets `path: resp.secure_url`, so by the time the manager ran, `file.path` was already the URL of an uploaded asset. Calling `cloudinary.uploader.upload(file.path)` made Cloudinary **fetch that URL and store a second copy**; only the second was saved, orphaning the first on every image, on every edit, permanently, in a paid account.<br><br>**Measured cost before the fix: 246 assets in Cloudinary, 135 referenced by the database — 111 orphans, 2.9 MB, 17% of stored bytes.**<br><br>**Fixed:** `updateProduct` now uses `file.path` directly (one upload, not two) and, **after the transaction commits**, deletes the assets it replaced via a new `utils/cloudinaryAssets.js`. Cleanup runs post-commit deliberately — inside the transaction a rollback would leave the database pointing at destroyed images, which is unrecoverable, whereas an orphan is merely wasteful. `destroyImagesByUrl` never throws for the same reason: a Cloudinary outage must not fail an update the admin has already been told succeeded.<br><br>`public_id` is **derived from the stored URL** rather than adding a column — the backfill for such a column would have had to derive it from these same URLs anyway. **Verified against all 138 stored URLs: 138/138 resolved.** (If delivery transformations are ever added to the URLs, this needs revisiting — noted in the helper.)<br><br>**Also deleted:** `productManager.updateImages` and `adminController.updateProductImages`, plus the commented-out route that referenced them. They were unreachable but carried the *same* double upload — leaving a working-looking image-replacement helper in place is exactly how the bug returns when someone uncomments one line. Closes `AB-30` for those three.<br><br>**Verified end to end:** uploading a replacement destroyed the previous asset (confirmed via the Cloudinary Admin API listing, not just an HTTP check — the old URL still returned 200 from CDN cache while the asset itself was gone). `scripts/find-orphaned-images.js` added to clear the existing backlog; it reports by default, requires `--delete`, prints which database it compared against, and **aborts if the database reports zero referenced images** — an empty or wrong database would otherwise make every asset look orphaned and wipe the account. | `productManager.js:49-58, :123` | **Every image on `PUT /update-product` is uploaded to Cloudinary twice, and the first copy is orphaned forever.** The route's `upload.array` already uploaded each file, so `file.path` is a remote Cloudinary URL; line 50 then calls `cloudinary.uploader.upload(files[i].path, ...)`, which makes Cloudinary fetch that URL and store a **second** asset. Only the second URL is persisted. Also: `grep -rn destroy src` returns **zero hits** — nothing in this codebase ever deletes a Cloudinary asset, including `deleteImagesByProductId`, which only removes DB rows. | Use `file.path` directly (it is already the uploaded URL) — remove the second upload. Add a `cloudinary.uploader.destroy` call to the image-delete path. Audit and clean existing orphans. | TODO |
| **AB-11** ✅ **DONE (Slice 2/3)** — `rejectNonScalarBody` mounted on both routers. Verified an array and an object in a body field are both rejected with 400 before reaching mysql2 | `dbOps/adminDbOps.js:73-84, 168-181, :180, :191` | **Non-scalar JSON values reach `mysql2` placeholders and corrupt the parameter list.** Nothing validates types. `{"regular_price": [1,2,3]}` → `SqlString.escape` expands the array to `1, 2, 3`, **injecting extra value slots into `VALUES (?, ?, …)`** and shifting every subsequent column. An object becomes `` `k` = 'v' ``. Values stay escaped so this is not SQLi, but it is silent data corruption and parameter smuggling. | Type-validate every body field (Phase 3). Consider `pool.execute` (server-side prepares) instead of `pool.query`. | TODO |
| **AB-13** ✅ **DONE (Slice 3)** — `[result]` destructured so `affectedRows` is real; controller returns **404** for a nonexistent order (was 200 "success"); `status` constrained to the six-state enum. Verified: order 99999 → 404, lowercase `"delivered"` → 400, all six valid states → 200 | `controllers/adminController.js:269-281`; `dbOps/adminDbOps.js:197-208` | **`PUT /api/update-order-status` reports success for orders that do not exist, and accepts any status string.** Two compounding bugs: (a) `const result = await pool.query(...)` without destructuring makes `result` an array `[OkPacket, fields]`, so `result.affectedRows` is `undefined` and `undefined === 0` is always false — **the guard is dead code**; (b) `status` is never validated, so `"delivered"` (lowercase) or `"Shipped!"` silently breaks the dashboard, which uses exact string equality `SUM(status = 'Delivered')`. Also `const result =` at line 272 is assigned and never used. | Destructure: `const [result] = await pool.query(...)`. Add the status enum (Phase 3). Return 404 when `affectedRows === 0`. | TODO |
| **AB-16** ✅ **DONE (Phase 5, Slice 4)** — the finding described the latent half; a **live** second bug shared the same cause.<br><br>**(a) LIVE on every order since the shipping fix:** the manager re-summed only the line items, while the customer was charged line items **plus** shipping. Verified on a real order — customer paid **₹4,099**, the admin panel showed **₹3,999**. The admin's records disagreed with what was actually collected, with no shipments and no special conditions required.<br><br>**(b) LATENT double-count:** `LEFT JOIN shipments` and `LEFT JOIN product_images` are not 1:1, so two shipment rows duplicate every line. Reproduced: order 10, real **₹11,996**, summed **₹23,992**. Fires the day parcels are recorded for DTDC / India Post.<br><br>**(c)** The same duplication listed the same saree twice in `product_list`.<br><br>**Fixed:** `amount` now comes from `o.total_amount` — the figure actually charged — instead of being recomputed; `product_list` is de-duplicated by `order_item_id`. `migrations/008_order_shipping_fee.sql` adds `orders.shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00`, written at checkout from the server constant, so a charge can be broken down after the fact. **Stored rather than derived:** `total_amount − SUM(items)` is correct only while the total has exactly two parts — a future discount or tax would be silently relabelled "shipping", and Razorpay reconciliation needs the exact split. The 0.00 backfill is factually correct, not a placeholder: all four existing orders predate the fee and reconcile to zero.<br><br>`createOrder` converted from 8 positional arguments to a named object — two money fields and two address-ish strings sat adjacent, and any swap would have written wrong data without erroring.<br><br>**Verified:** a new order records `total 4099 = items 3999 + shipping 100`, reconciling to zero; with **2** shipment rows order 10 stays ₹11,996 (was ₹23,992) and with **3** rows order 43 stays ₹4,099 (would have been ₹11,997); item counts do not inflate; all five orders' displayed amounts match `orders.total_amount` exactly. Admin order page now shows Subtotal / Shipping / Total. Applied to **local only** — ⚠️ migration 008 must run on Hostinger. | `dbOps/sqlQueries.js:34-44`; `components/orderManager/orderManager.js:28-40` | **Order totals are double-counted.** `getAllOrderData` does `LEFT JOIN shipments s` and `LEFT JOIN product_images pi`; neither is guaranteed 1:1. Two shipment rows → every `order_item` row duplicates → the product is pushed twice → the `reduce` sums it twice → **`amount` is 2× the real order value**. Nothing enforces a single primary image either: `resetPrimaryImageByImageId` exists (`adminDbOps.js:224`) and is **never called**. The correct value `o.total_amount` is available and ignored. | Use `o.total_amount` directly. If per-item detail is needed, fetch it in a separate query or de-duplicate with a subquery/`GROUP BY`. Wire up or delete `resetPrimaryImageByImageId`. | TODO |
| **AB-17** ✅ **DONE (Phase 5, Slice 2)** — **the finding understated it.** The root cause was not bad SQL but **three disagreeing status vocabularies**: the database enum (6 states), `getOrderStats` counting `SUM(status = 'Active')` — a status this system has never written — and `DashBoard.jsx` counting `['pending','processing','shipped']`. Between them, **`Confirmed`, `Packed` and `Out for Delivery` were counted NOWHERE**: an order in any of those three appeared in neither card. Proven with one order in each of the six states — 10 orders in the table, SQL reported **0 active**.<br><br>**Fixed:** `ORDER_STATUS_ACTIVE` / `ORDER_STATUS_TERMINAL` added to `appDefines.js` and **derived** from `ORDER_STATUSES` (never re-typed — re-typing is what caused this); mirrored in a new `admin-frontend/src/constants/orderStatus.js` that is the single source for counts, tabs and sorts. `getOrderStats` now binds the active list as an `IN (?)` array. **`COALESCE(...,0)`** added — `SUM()` over zero rows returns `NULL`, which matters because the placeholder data is **wiped at handover**, so the client's first dashboard would have rendered `null`. `CAST(... AS UNSIGNED)` added — `SUM()` returns DECIMAL, which mysql2 maps to a **string**, so the endpoint was returning `{totalOrders: 4, activeOrders: "0"}`, a number and two strings in one object. `getBestSellers`: `LIMIT`, plus a correlated-subquery primary image (a `LEFT JOIN` would have re-created the `AB-16` row multiplication). `getRecentOrders`: `LIMIT`, and `INNER JOIN` → `LEFT JOIN master_user` so orders from a removed customer stop vanishing. **Verified:** 6 states → `{total:9, active:5, completed:4}`, `active + completed === total`, all three numbers; empty table → `{0,0,0}`; all three endpoints 200 with auth, 401 without. | `dbOps/sqlQueries.js:28-30, :13` | **Four broken dashboard aggregations.** (a) `getOrderStats`: `COUNT(*) FROM orders` with **no `WHERE`** — cancelled/test orders inflate the total; `SUM(status='Active')` returns **`NULL`** not `0` on an empty table. (b) `getBestSellers`: no `p.is_deleted = 0`, and **no `LIMIT`** on a query named "best sellers" — returns the entire delivered catalogue. (c) `getRecentOrders`: **no `LIMIT`** on a query named "recent orders"; `JOIN master_user` is an **INNER** join, so orders whose user row was removed vanish, making the dashboard disagree with `getOrderStats`. (d) `getAllOrderData` / `getAllProductDetails`: no `LIMIT`, no pagination — full-table + all-images on every call, and unauthenticated per `AB-01`, so also a cheap DoS. | Add `WHERE`/`is_deleted` filters, `LIMIT`, `COALESCE(..., 0)`, `LEFT JOIN` for the user, and pagination on the list endpoints. | TODO |
| **AB-18** ✅ **DONE** (error handler) · ⚠️ `adminController.js:15` destructure still outside the `try` — Phase 3 | `server.js:20-23`; `controllers/adminController.js:15` | **No global error-handling middleware → Express's default handler returns full stack traces in HTTP responses.** `NODE_ENV` is unset (`.env` has only Cloudinary keys), so finalhandler runs in development mode. Two live paths reach it: the multer `fileFilter` rejection / `LIMIT_FILE_SIZE`, and `adminController.js:15` where `const { pri_email, passwd } = req.body;` sits **outside** the `try` that starts at line 28 — a non-JSON `Content-Type` makes `req.body` undefined and throws a `TypeError`. | Add `app.use((err, req, res, next) => …)` returning a generic message. Set `NODE_ENV=production`. Move the destructure inside the `try`. | TODO |
| **AB-19e** ✅ **DONE (Phase 5.5, Slice 2)** — **measured before the fix: 235ms for an existing account vs 19ms for an unknown one**, a 216ms oracle letting anyone test whether this shop has an account for any address. The miss path returned before reaching bcrypt at all. Both backends now burn an equivalent compare against a fixed cost-12 `DUMMY_HASH` (hardcoded, not generated at boot — hashing at cost 12 costs ~230ms and would be paid on every Render cold start). **After: 244ms vs 236ms**, an 8ms difference inside noise.<br><br>**Also fixed here, and it was blocking the above:** `CB-28` raised bcrypt to cost 12 for **NEW hashes only** — verified that all 22 existing rows were still `$2b$10$` while a fresh signup was `$2b$12$`. A cost-10 compare is ~4x faster than the cost-12 dummy, so legacy accounts would have stayed distinguishable. Added **transparent rehash on login**: the plaintext is available exactly once, at authentication, so a legacy hash is upgraded then. Failure is swallowed deliberately — the user has already authenticated and must not be blocked by a background upgrade. **Verified:** the admin row went `$2b$10$` → `$2b$12$` on login, the same password still works, a wrong one still 401s. The 21 customer rows upgrade as they sign in. A `NULL` `pass` is also now handled, which previously made `bcrypt.compare` reject and surface as a **500 instead of a 401**. | `dbOps/adminDbOps.js:11-15` | **User enumeration via timing.** `if (rows.length === 0) return null;` returns in ~1 ms; an existing email then burns a full `bcrypt.compare` (~100 ms). A 100× delta, trivially measurable. Also, a `NULL` `user.pass` makes `bcrypt.compare` reject → 500 instead of 401. | Always run a dummy `bcrypt.compare` against a fixed hash on the miss path. Return an identical 401 body either way. Guard `NULL` hashes. | TODO |
| **AB-20** ✅ **DONE (Phase 5.5, Slice 3)** — `public_id` is now `crypto.randomBytes(16).toString('hex')`, generated server-side; the client's filename is not used at all. It was `${Date.now()}-${file.originalname}`, and `originalname` comes straight from the multipart `filename` parameter — it can contain `/` and `..`, Cloudinary treats `/` as a folder separator, and signed uploads overwrite by default, so a crafted filename could write outside `products/` and overwrite another product's asset. Generating the id removes the class of problem rather than trying to sanitise a hostile string: there is nothing left of the client's input to escape. It also fixes a quieter bug — two files uploaded in the same millisecond with the same name previously collided and overwrote each other. **Verified:** new uploads land as `products/<32 hex chars>`. | `middlewares/cloudinaryUpload.js:17` | **Client-controlled `originalname` flows into the Cloudinary `public_id`**: `` `${Date.now()}-${file.originalname}` ``. `originalname` comes from the multipart `filename` parameter and can contain `/` and `..`. Cloudinary treats `/` as a folder separator and signed uploads default to `overwrite: true` — enabling writes outside `products/` and **targeted overwrite of existing assets in other folders**. | Sanitise to `[a-zA-Z0-9._-]`, strip path separators, enforce an extension allow-list, or generate the `public_id` server-side and ignore `originalname` entirely. | TODO |
| **AB-21** ✅ **DONE (Phase 5.5, Slice 3)** — the filter now checks an explicit **mimetype allowlist AND an extension allowlist** (jpg/jpeg/png/webp/avif) instead of `file.mimetype.startsWith('image/')`, and `limits.files` was added to match `upload.array('images', 10)`. **Verified:** a `.txt` file declaring `Content-Type: image/jpeg` is rejected.<br><br>**Honest scope note:** `mimetype` is still a client claim, so these are a cheap early filter, not the security boundary. The real boundary is Cloudinary — `resource_type: 'image'` refuses anything it cannot decode and `format: 'webp'` re-encodes what it accepts, so the stored bytes are Cloudinary's output rather than whatever was uploaded. Magic-byte inspection (`file-type`) would be stricter, but multer exposes only a stream at `fileFilter` time and this route has been admin-only since `AB-01`/`AB-09`, so the extra dependency and stream-buffering were judged disproportionate. Recorded as optional hardening. | `middlewares/cloudinaryUpload.js:24` | File-type validation uses `file.mimetype`, which is the **client-supplied** part `Content-Type`. An attacker can upload any file as `image/jpeg`. Partially mitigated by `resource_type: "image"` + `format: "webp"` (Cloudinary re-encodes), but the check itself is worthless. | Validate with a magic-bytes library (`file-type`) after receiving the buffer, before uploading. Keep the Cloudinary re-encode as defence in depth. | TODO |
| **AB-24** ✅ **DONE (Slice 1)** — replaced with `jwt.sign`, 1-day lifetime, distinct secret per service; 9/9 verification tests pass | `utils/utils.js:37` | **Session tokens are computed from guessable inputs.** `sha256(data + Date.now())` where `data` is `user_id` (a small enumerable integer) or `lastSession.sid`. Knowing the user_id and the login day gives ≈ 8.6 × 10⁷ candidates — an offline GPU sweep of well under a second. No salt, no HMAC. Two logins in the same millisecond produce an **identical** token. Note `createSessionId()` on line 41 does it correctly with `randomBytes(16)`. | Replace with `jwt.sign(...)` (Phase 2.1) or `crypto.randomBytes(32).toString('hex')`. **Must ship with `AB-01`** — see [CONSTRAINT 2](#2-hard-ordering-constraints). | TODO |

#### MEDIUM

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **AB-05b** | `controllers/adminController.js:122, 157, 177, 222, 235, 248, 265, 279, 296, 320, 335, 344, 353, 363, 372, 381, 393, 402, 423`; `utils/utils.js:16` | Raw `error.message` returned in every 500. `mysql2` messages leak table names, column names, constraint names and sometimes query text. | Generic client message; `console.error` server-side only (and see `AB-32`). | TODO |
| **AB-10c** ✅ **DONE (Slice 3)** — `express-validator` rule sets on create/update product, category, order status, image insert and all `:id` params. Verified: `"abc"` price, negative price, `selling > regular`, negative stock and a 256-char name all rejected | `controllers/adminController.js:164, 271, 303, 408`; `components/productManager/productManager.js:10, 27` | **No input validation.** Only presence checks. No type/range/enum validation anywhere; `express-validator` is not installed. `id` params are not numeric-checked. | Phase 3. | TODO |
| **AB-11b** ✅ **DONE (Phase 5.5, Slice 2)** — `getUserDetails` names its columns instead of `SELECT *`, in both backends. `pass` is deliberately still included: this query backs password verification, so the hash is genuinely needed. What is no longer pulled is every other column the row happens to carry. Confirmed during the sweep that the hash was **never leaked** — the login response hand-picks its fields — so this is defence in depth: one careless `res.json(user)` would have exposed whatever this returned. | `dbOps/sqlQueries.js:3` | `SELECT * FROM master_user` pulls the bcrypt hash into memory on every login attempt. **Not leaked to the client** (`adminLoginManager.js:21-30` returns an allow-list), so hygiene only — but one careless `res.json(userData)` would expose it. | Select only `user_id, user_name, pri_email, role_id, user_status_id, is_delete`. | TODO |
| **AB-12** ✅ **DONE (Slice 5)** — replaced by the 2-device cap with oldest-first eviction. Verified device 3 evicts device 1 | `components/adminLoginManager/adminLoginManager.js:32` | `appConstants` is referenced but **never imported** (the file only requires `dbCmds`, `utils`, `appDefines`). When the catch block fires it throws `ReferenceError: appConstants is not defined`, **destroying the original DB error**. | Import it, or replace with the literal `500`. | TODO |
| **AB-14** | `components/productManager/productManager.js:14-20, 60-64` | No transactions. See [Phase 4.2](#42-transactions) — `AB-14b` is destructive and non-recoverable. | Phase 4.2. | TODO |
| **AB-15** | `components/adminLoginManager/adminAuthManager.js:24`; `adminLoginManager.js:13`; `dbOps/sqlQueries.js:20` | Non-atomic read-then-write in the login path (concurrent logins both insert; the loser stays `ACTIVE` forever, unreachable and unrevocable). `updateProductStock` is an absolute `SET`, so concurrent admins silently overwrite each other (lost update). | Phase 4.2. | TODO |
| **AB-22** ✅ **DONE (Slice 5)** — the duplicate unreachable `PUT /update-product` registration removed | `routes/adminRoutes.js:10-14` and `:32` | `PUT /api/update-product` is registered **twice**. Line 32 is unreachable dead code and a maintenance trap. | Delete line 32. | TODO |
| **AB-23** ✅ **DONE — early, during Phase 4 Slice 3** (recorded honestly rather than backdated to Phase 6). Removed 6 duplicate definitions: `addCategory` ×2, `getAllCategories` ×3, `deleteAllCategories` ×2. All were byte-identical copy-paste. **Pulled forward because it was blocking:** adding duplicate-key handling to `addCategory` would have patched a definition Node never runs. 18 handlers remain, zero duplicates. | `controllers/adminController.js` — `addCategory` at 327, 355, 385; `getAllCategories` at 339, 367, 397; `deleteAllCategories` at 348, 376 | **Duplicate export definitions.** In Node the last definition wins; the earlier ones are silently discarded. Evidence of copy-paste without cleanup. | Keep one of each, delete the rest. Verify which one the routes actually reach first. | TODO |
| **AB-25** ✅ **DONE — early, during Phase 4 Slice 3.** Both `deleteAllCategories` definitions deleted. Confirmed first that it was unrouted AND that `productManager.deleteAllCategories` does not exist, so it would have thrown `TypeError` — a mass-deletion handler one route line away from being live. | `controllers/adminController.js:348-354, 376-383` | **`deleteAllCategories` is a wired-up mass-destruction handler that would throw.** It calls `productManager.deleteAllCategories()`, which does not exist in that module's export list — so it would `TypeError`. Currently unrouted, but duplicated twice and one route line away from being live. | Delete both definitions. | TODO |
| **AB-26** ✅ **DONE (Slice 5)** — `sid` removed from the login response | `controllers/adminController.js:107, :109` | `sid` (the session table auto-increment PK) and `user_status_id` are returned in the login response. Leaks internal DB structure and the session table's row count; enables session enumeration. | Remove both from the response body. | TODO |
| **AB-27** ✅ **DONE (Phase 5.5, Slice 3)** — `cloudinaryUpload.js` now requires the shared `config/cloudinary` module instead of calling `require('cloudinary').v2` and `cloudinary.config()` a second time. Two independent configurations of the same singleton meant changing credentials in one place silently left the other on the old values, with neither file obviously the authority. `productManager` no longer imports cloudinary at all — it uploads through the storage layer and deletes through `utils/cloudinaryAssets`. | `config/cloudinary.js:3-7` and `middlewares/cloudinaryUpload.js:5-9` | Cloudinary is configured **twice**, independently. `cloudinaryUpload.js` imports the library directly rather than the shared config. Also `config/cloudinary.js` does not call `dotenv.config()` — it works only because `server.js:6` ran first. | Single config module; import it everywhere. Call `dotenv.config()` explicitly at the entry point. | TODO |
| **AB-28** ✅ **DONE (Slice 5)** — login always creates a fresh session and issues all four cookies. Verified `session_id` is present on the FIRST login | `controllers/adminController.js:45-60` | **Login on a second device sets NO session cookies.** If a valid session already exists, the handler returns `200 { message:'Login successful', validSession:true }` and sets only the `token` cookie — and only if `loginResult.token` is truthy, which is `null` whenever the existing token is still fresh. No `session_id`, no `role_id`, no `pri_email`, no `sid`. **The client is told it succeeded while receiving nothing to authenticate with.** This is the backend half of `AF-16`. | Always issue a full, fresh cookie set on any successful login. Decide the multi-session policy explicitly. | TODO |
| **AB-31** | `dbOps/sqlQueries.js:24, :11-14, :12` | Deleting a category soft-deletes the `category` row, but `product.category` is a **denormalised free-text string column**, and `getCategoryWiseCount` groups by `p.category` independently of the `category` table. **Deleting a category has no effect on products**, and the two endpoints disagree permanently. | `DB-06` (normalise to `category_id` + FK). | TODO |
| **AB-43** 🆕 ✅ **DONE — reported by the owner from a real order, 2026-08-29** | `dbOps/sqlQueries.js` `getAllOrderData`; `orderManager.js`; `AdminHomePage.jsx` `normalizeOrders`; `DisplayOrderPage.jsx` | **Three defects on the admin order-detail page, all visible on one screenshot of a genuine order.**<br><br>**(a) The customer's email was always blank.** `DisplayOrderPage` renders an `Email:` line, but `getAllOrderData` never selected `mu.pri_email` and `normalizeOrders` never mapped one — the exact shape of `AB-42`'s contact-number gap, in the same query, missed when that was fixed. Now selects `mu.pri_email AS customer_email` and maps it through. Every field in that block also gained an em-dash fallback, because **a blank after "Email:" reads as "this customer has no email" rather than as a bug** — which is precisely why it went unnoticed until an order was inspected by hand.<br><br>**(b) The order date read `29/08/2026, 16:24:54`.** Bare `toLocaleString()` follows the *viewer's* machine locale, so the same order would read `8/29/2026` on another computer. Now `29 August 2026 4:24 PM` — locale and fields named explicitly so the output is stable, seconds dropped, `en-IN`'s " at " and lower-case meridiem normalised. The `null` → **1 January 1970** trap is still guarded.<br><br>**(c) Subtotal / Shipping / Total sat one column left of the Amount column.** The table has **eight** columns but the footer used `colSpan={6}` plus one amount cell — seven. `colSpan={7}` makes 8. This is the misalignment `AF-30` had already noted in passing; it became obvious once Slice 4 added the Subtotal and Shipping rows beside it. | Select the email, format the date explicitly, correct the colSpan. | **DONE** |
| **AB-42** ✅ **DONE (Phase 5, Slice 2b)** — found during Slice 2 | `dbOps/sqlQueries.js` `getAllOrderData`; `AdminHomePage.jsx` `normalizeOrders`; `RecentOrders/Columns.jsx:137`; `RecentOrders/Data-table.jsx:89`; `client-backend` `createOrder` | **The admin order table's "Contact Number" column was permanently empty, and the phone search could never match** — and the cause was worse than it first appeared.<br><br>⚠️ **My initial diagnosis was wrong and is corrected here.** I recorded this as "`CF-09` is fixed, so the data now exists — it just is not surfaced", and proposed a one-column join to `master_user`. Checking the write path showed the number was never stored **anywhere**: `Checkout.jsx` sends `customer_name`, `email`, `phone_number`, `shipping_address`, `payment_method`, `items`, while `createOrder` destructured only `shipping_address` and `payment_method`, and `orders` had **no phone column at all**. So the number the customer typed was discarded on every order. `CF-09` fixed the *form*; nothing persisted the result. Its checklist line correctly remained unticked.<br><br>**The telling inconsistency:** the shipping ADDRESS for a parcel was stored per order, while the contact PHONE for that same parcel was thrown away. A courier label needs both.<br><br>**Fixed (owner chose Option B over the cheap join, 2026-08-28):** `migrations/007_order_contact_phone.sql` adds `orders.contact_phone VARCHAR(20) NULL`; `createOrder` reads and stores it, validated by `v.createOrder` using the **same** `isAcceptedPhone` rule as signup and profile; `getAllOrderData` selects `COALESCE(o.contact_phone, mu.phone_number) AS contact_number` — per-order contact wins, account phone is the fallback for the four pre-007 orders; mapped through `orderManager` and `normalizeOrders`.<br><br>**Why not simply join `master_user.phone_number`:** that is the ACCOUNT holder's number. A customer ordering a gift enters the recipient's number at checkout, and the join would confidently show the wrong person. **Verified:** an order placed with delivery phone `+919888877766` against a profile phone of `+919000000001` stored and displayed the delivery number, while every pre-007 order correctly fell back to the account phone; `"abc"`, `"12345"`, `+91` starting `1`, and a 21-character value were all rejected 400; omitting the field is allowed and stores NULL. Applied to **local only** — ⚠️ must run on Hostinger. | Add `mu.phone_number AS contact_number` to `getAllOrderData`, map it in `normalizeOrders`, and confirm the phone search matches. | **DONE** |
| **AB-32** | 15+ `console.error` sites | Logs full `Error` objects. For `mysql2` these include the failing SQL **and bound parameter values** — i.e. customer email addresses and PII land in stdout logs. | Log `error.code` + a message, never the full object. Redact parameters. | TODO |

#### LOW

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **AB-19** | `server.js` | No `helmet`; no `app.disable('x-powered-by')`. No HSTS, CSP, `X-Content-Type-Options`, or frame protection. `X-Powered-By: Express` on every response. | `npm i helmet`; `app.use(helmet())`; `app.disable('x-powered-by')`. | **DONE** — helmet 8.3.0. Verified live: `Referrer-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-DNS-Prefetch-Control`, `X-Frame-Options` all present; `X-Powered-By` absent. |
| **AB-29** | `middlewares/asyncHandler.js` | Implemented, exported, and **never used** anywhere. All controllers hand-roll try/catch. | Delete, or adopt it consistently. | TODO |
| **AB-30** | `controllers/adminController.js:283-298`; `routes/adminRoutes.js:45`; `dbOps/adminDbOps.js:218, :224` | `updateProductImages` is orphaned (its route is commented out). `getImagesByProductId` and `resetPrimaryImageByImageId` are never called. | Delete or wire up. Note `resetPrimaryImageByImageId` is needed by `AB-16`. | TODO |
| **AB-33** ✅ **DONE (Slice 5)** — the unused `session_id`/`token` parameters are gone; `validateAdminLogin` now only verifies credentials | `components/adminLoginManager/adminAuthManager.js:6` | Declares `session_id` and `token` parameters that are **never referenced** in the body. The client's cookies are structurally incapable of affecting the login decision — the session is resolved purely by `pri_email` from the request body. | Will be replaced by Phase 2.1. Remove the misleading parameters. | TODO |
| **AB-34** | `utils/utils.js:6-10` | `sendResponse` hardcodes `success: true` while accepting a `status` parameter — a caller passing `400` gets `{success: true}` with a 4xx code. | Derive `success` from the status code. | TODO |
| **AB-35** | `controllers/adminController.js:21-25` | Calls `utils.handleMissingParams(res, msg, 'msg.error.missingRequiredFields')` but the signature is `(res, msg)` — the locale key is silently dropped, unlike every other error path. Inconsistent error contract. | Fix the signature or the call. | TODO |
| **AB-36** | `routes/adminRoutes.js:30` | Route typo: `/get-order-detils`. | Rename to `/get-order-details`; update the frontend caller (`AF-*` network table row 4). | TODO |
| **AB-37** | `server.js` | No `express.urlencoded()` — any HTML form / `x-www-form-urlencoded` client gets `req.body === undefined` and hits `AB-18`. | Add `app.use(express.urlencoded({ extended: true, limit: '100kb' }))`. | TODO |
| **AB-38** | `server.js:25` | `const PORT = 9032` hardcoded instead of `process.env.PORT`. Port config is being managed by editing tracked source (this is currently an uncommitted local edit from `3006`). | `const PORT = process.env.PORT || 9032`. | TODO |
| **AB-39** | `config/db.js` | No `pool.on('error')` handler, no connection health check. `connectionLimit: 10` with `queueLimit: 0` (**unbounded** queue) means a DB stall queues requests without limit. | Add an error handler and a finite `queueLimit`. Add a `/health` endpoint. | TODO |
| **AB-40** | `server.js` | No graceful shutdown (`SIGTERM`), no `process.on('unhandledRejection')`. | Add both. | TODO |
| **AB-41** | `sqlQueries.js:6` (admin) · `sqlQueries.js:19` (client) · both `*AuthManager.js:29` | **Token expiry has never been enforceable, and the assumed cause was wrong.** The plan said renewal "fails to reset `token_created_time`". In fact **that column does not exist in the schema at all** — verified with `DESCRIBE session`. So `lastSession.token_created_time` is `undefined`, `now - new Date(undefined)` is `NaN`, and `NaN < tokenExpiryMs` is always false: every login takes the "token expired" branch and regenerates. Writing the prescribed fix would have crashed with `ERROR 1054 Unknown column`. | **DONE (Slice 1)** — column deliberately **not** added; the JWT now carries its own `exp` claim, so a separate DB timestamp is redundant. `updateToken` left as `SET token = ?`. The `*AuthManager` renewal paths that read the phantom column are removed in Slices 4–5. |

---

### Client backend — `CB-*`

`client-backend/src/` unless stated otherwise.

#### CRITICAL

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **CB-01** ✅ **DONE (Slice 4)** — every non-catalogue route now carries `authMiddleware`; verified anonymous → 401 across all of them | `middlewares/authMiddleware.js` (0 bytes); `server.js:20` (`//app.use(authMiddleware);`); `routes/customerRoutes.js:7-54` | **Zero authentication on all 23 routes.** The middleware file is empty and the `app.use` is commented out. `req.cookies` is referenced in exactly one place (`customerController.js:61-62`), inside `customerLogin`, and even there the values are passed to `validateCustomerLogin(pri_email, passwd, session_id, token)` which **never reads parameters 3 and 4**. The token cookie is write-only: issued at login, never read, never verified. | Phase 2.1. | TODO |
| **CB-02** ✅ **DONE (Slice 4)** — all 14 handlers read `req.user.user_id`; the `:user_id` segments and `?user_id=` query were **removed from the URLs entirely**, so the attack is now unexpressible rather than merely guarded. `/order/:order_id` keeps its param and gets an explicit ownership check returning **404** (not 403, which would confirm the order exists). Verified: `?user_id=9` is ignored and returns the caller's own empty cart, not user 9's seven items. | `controllers/customerController.js` — 14 handlers, see [Phase 2.2 table](#22-backend--kill-the-idor) | **Complete IDOR on every user-scoped route.** `user_id` / `order_id` come straight from the client with no ownership check. IDs are sequential. Full PII scrape of all 25 customers in 25 unauthenticated requests; read/write of any user's cart, wishlist, orders and profile. | Phase 2.2. | TODO |
| **CB-03** | `controllers/customerController.js:581, :615-622`; `dbOps/sqlQueries.js:216-220` | **`payment_status` and `status` are client-controlled → free goods.** An unauthenticated `POST /api/orders/create` with `{"payment_status":"Paid","status":"Delivered"}` creates a paid, delivered order. There is no payment gateway anywhere in the codebase. | **Never accept `payment_status` from the client.** Server-assign `'Unpaid'` / `'Pending'`. Mark paid only from a verified gateway webhook. Whitelist `status`. | **DONE** — both fields removed from the destructure and server-assigned. **Verified by exploit attempt:** POST claiming `payment_status:"Paid", status:"Delivered"` recorded `Unpaid` / `Pending` in the DB. |
| **CB-04** ✅ **DONE (Slice 4)** — route and handler deleted; verified 404. The internal `productManager.addOrderItem` helper is retained for `createOrder`, which prices every line from the product table. | `controllers/customerController.js:717-727`; `dbOps/sqlQueries.js:222-226` | **`POST /api/order/add-item` accepts an arbitrary price on an arbitrary order.** `{order_id, product_id, quantity, price}` are inserted verbatim. No ownership check, no product lookup, no stock reduction, and **`orders.total_amount` is never recalculated**. With no FKs on `order_items` (see `DB-01`), any product can be attached to any order at ₹0.01. **Note:** the storefront never calls this route (verified) — an attacker must hit the API directly. | **Delete the route and the handler entirely.** Order-item insertion must only happen inside `createOrder`. | TODO |
| **CB-05a** ✅ **DONE (Slice 4)** — `user_id` now comes from the session, so ordering on another user's cart is impossible | `controllers/customerController.js:588, :581, :631` | **Order-on-behalf-of-victim / cart theft.** `getCart(user_id)` uses the **body-supplied** `user_id` as the cart source while `shipping_address` is attacker-supplied. An unauthenticated request creates an order billed to the victim, reduces real stock, and **clears the victim's cart**. | Phase 2.2 (read `user_id` from the token only). | TODO |
| **CB-06** | `controllers/customerController.js:579-639` | **No transaction on the order flow.** `grep` for `getConnection|beginTransaction|commit|rollback` over `src/` returns **zero** hits; all 31 DB calls are bare `pool.query`. A failure at item *k* leaves the order row, items 1..k, stock decremented for 1..k-1, and the cart **not** cleared — orphaned half-orders with a wrong `total_amount`. | Phase 4.2. | TODO |
| **CB-07** | `server.js:8-13` | `cors({ origin: true, credentials: true })`. No CSRF token, no `SameSite`. | Explicit allowlist. See [CONSTRAINT 1](#2-hard-ordering-constraints). | **DONE** — same env-driven allowlist as `AB-02`, verified identically. `SameSite` lands in Slice 8. **Constraint 1 step 2 is now satisfied**, so Phase 2 may proceed to cookies and then `credentials: 'include'`. |
| **CB-11** | `server.js`; `routes/customerRoutes.js:7, :11` | **No rate limiting.** `/api/customer-login` and `/api/signup` are unthrottled. With bcrypt cost 10 this is also a cheap single-thread CPU-exhaustion DoS (~80-100 ms per attempt). | `express-rate-limit` on both. | **DONE** — `express-rate-limit` 8.6.2. Login: 10 **failed** attempts / 15 min with `skipSuccessfulRequests`, so normal use never locks anyone out. Signup: 10 req / 15 min, counting all requests (limits bulk account creation). `app.set('trust proxy', 1)` in production. **Verified:** 14 consecutive successful logins → 0 blocks; 12 failures → 429 from the 11th. `RateLimit-*` headers exposed; 429 returns JSON. |
| **CB-21** | `dbOps/sqlQueries.js:16, :21` | **Login does not check `is_delete`.** `SELECT * FROM master_user WHERE pri_email = ?` with no `AND is_delete = 0`, even though the column exists and is `NOT NULL DEFAULT 0`. `grep -n is_delete src/` finds it only in the signup INSERT. **Soft-deleting a user does not revoke their access.** | Add `AND is_delete = 0` to both queries and to the session lookup in the new auth middleware. | TODO |
| **CB-24** ✅ **DONE (Slice 1)** — replaced with `jwt.sign`, 7-day lifetime, distinct secret per service; 9/9 verification tests pass | `utils/utils.js:21-23`; `components/customerLoginManager/customerLoginManager.js:10` | **Cryptographically predictable session tokens** — `sha256(user_id + Date.now())`. ~2²⁷ candidates for a day's window, a few thousand if the login minute is known. `user_id` is trivially enumerable via `CB-02`. Unsalted, unkeyed, no HMAC. `jsonwebtoken` **is installed and never imported**. Note `createSessionId` (`utils.js:25-27`) correctly uses `randomBytes(16)`. | Phase 2.1. **Must ship with `CB-01`** — [CONSTRAINT 2](#2-hard-ordering-constraints). | TODO |

#### HIGH

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **CB-08** | `utils/utils.js:17-19` | `res.cookie(key, value, { maxAge, httpOnly: true })` — no `secure`, no `sameSite`, not signed. Client can forge `role_id` / `pri_email` in a raw HTTP request. | Same as `AB-04`. Never trust a cookie value for authorization. | **DONE** — same flags as `AB-04`, verified in both modes. Note the cookies are still **unsigned**, so `role_id` / `pri_email` remain forgeable in a raw request — Phase 2 must read identity from the verified JWT, never from these cookies (`CB-09`). |
| **CB-05** ✅ **DONE** — verified `Max-Age=86400` | `controllers/customerController.js:144-152`; `utils/utils.js:33-35` | **Cookie `maxAge` multiplied by 86,400,000** — identical bug to `AB-05`. Verified: `maxAge` = 7,464,960,000,000,000 ms → expires `+238581-10-20`. `session_id`, `role_id`, `pri_email` are permanent cookies; only `token` gets its correct 1-hour lifetime. | Same as `AB-05`. | TODO |
| **CB-09** ✅ **DONE (Phase 5.5, Slice 2)** — `role_id` and `pri_email` are no longer set as cookies, on **either** backend. Both were `httpOnly`, so the frontend could not read them, and a grep across both services confirmed nothing else did either: write-only cookies advertising the account's privilege level and address on every request. On the admin side worse still — a cookie reading `role_id=0` marks the request as the administrator's. `role_id` lives in the signed JWT, and `requireAdmin` reads it from the database row regardless (`AB-08`). Logout still **clears** both names so anyone carrying them from an older session has them removed. **Verified:** login now emits exactly `session_id` and `token`. | `constants/cookieKeys.js:5-6`; `controllers/customerController.js:132-141` | `pri_email` and `role_id` stored in cookies. `role_id` is set `httpOnly`, so the frontend cannot even read it — it serves no purpose except leaking the privilege level to anyone with network access. | Remove both cookies. Carry `role_id` inside the signed JWT. | TODO |
| **CB-10** | `config/db.js:5-8` | Hardcoded `root` / `admin123` / `db` fallbacks. **There is no `client-backend/.env` at all**, so these are the live config. | [CONSTRAINT 3](#2-hard-ordering-constraints), then throw on missing env. | **DONE** — `.env` created (this service had none); fallbacks replaced with the same `required()` helper. Verified: boots normally, refuses to boot without `DB_PASS`. `JWT_SECRET` deferred to Phase 2. |
| **CB-12** | `controllers/customerController.js:171, 201, 219, 238, 257, 287, 316, 337, 455, 476, 501, 520, 534, 545, 575, 637, 670, 711, 737` | Raw `err.message` returned in **19** places. A working error oracle for probing the schema (`ER_NO_SUCH_TABLE`, `Unknown column 'NaN'`). | Phase 3. | TODO |
| **CB-13-err** ✅ **DONE** | `server.js` | **No error-handling middleware and no 404 handler; `NODE_ENV` never set** → Express's default handler ran in development mode and returned full stack traces to the client. | Added a 4-arity global error handler (logs server-side, returns a generic message, never the stack) and a JSON 404 handler. `require('dotenv').config()` also added explicitly — it previously ran only as a side effect of requiring `config/db.js`, so a change in require order would have silently dropped every env var (`CB-37`, now partly closed). **Verified:** malformed JSON returns `{"success":false,"message":"Something went wrong. Please try again."}` with no stack, while the full error still reaches the server log. | |
| **CB-13** ✅ **DONE (Slice 2)** — `POST /api/logout` added; verified the DB row flips to `LOGOUT` and the same cookie is rejected on the very next request | `routes/customerRoutes.js` | **No logout endpoint.** `SESSION_LOGOUT` is written only in the expiry path (`customerAuthManager.js:53-57`). The production `session` table is at AUTO_INCREMENT 1044 with no logout mechanism. Frontend "logout" only clears localStorage. | Add `POST /api/logout` (Phase 2.1 step 6). | TODO |
| **CB-22** ✅ **DONE** | `dbOps/sqlQueries.js:177-180`; `controllers/customerController.js:552-577` | **Duplicate cart rows — the backend half of the over-billing bug.** `addToCart` is a bare `INSERT ... VALUES (?, ?, 1, NOW())` with no upsert and no existence check. `checkCart` exists (`customerDbOps.js:297-309`) and **is** used by `moveWishlistToCart` — but `addToCart` skips it. The schema has **no unique constraint on `(user_id, product_id)`** (contrast `wishlist`, which correctly has one). N clicks → N rows at quantity 1 → `getCart` shows the product N times → `updateCartQuantity` updates **all N rows** → `createOrder` creates N `order_items` and **multiplies the total by N**. | Add `ON DUPLICATE KEY UPDATE quantity = quantity + 1` **and** the unique index (`DB-02`). Frontend half is `CF-02`. | TODO |
| **CB-23** | `controllers/customerController.js:581` and the `orders` INSERT | **`undefined` silently overrides column DEFAULTs.** All access uses `pool.query` (client-side escaping), never `pool.execute`. `undefined` is escaped to the literal `NULL`, which **overrides** `orders.status DEFAULT 'Pending'` and `payment_status DEFAULT 'Unpaid'`. Since `status`/`payment_status` are optional in the handler, any client omitting them writes `NULL`. **Confirmed in production: `orders` rows 12 and 13 have `status = NULL`.** Same class of bug for the optional `address` at signup. | Never pass `undefined` — coalesce to the intended default in JS, or use `pool.execute`. Backfill via `DB-04`. | TODO |
| **CB-24b-data** ✅ **DONE (Phase 5, Slice 6)** — product 49's `selling_price` set to **4999.00** (owner's choice: match `regular_price`, no discount). **0 unpriced products remain.** Owner widened the fix beyond the data: prices may no longer be null, empty or 0 **anywhere**. `priceRules` in the admin validators now requires `min: 0.01` (0.01 rather than a bare `> 0` because the column is `DECIMAL(10,2)` — anything smaller rounds to 0.00 on write, storing exactly the value the rule rejects), `selling_price` is no longer `optional` on create, and `optional` on update was changed from `values: 'falsy'` to `values: 'undefined'` — `''` and `0` are falsy and had been skipping validation entirely. `UpdateProduct.jsx` had **no price validation at all**, only a name check, so an existing product could be saved with its price blanked; it now matches `AddProduct` and the server. Feedback moved from blocking `alert()` to a toast. **Verified:** `selling_price` of 0, omitted, null and `''`, `regular_price` of 0 and omitted, and `selling > regular` are all rejected 400; a fully valid product still saves. | ~~NEW — live instance of CB-24b~~ | `product` id **49**, "Royal Crimson Kanchipuram Silk" | **A real product in the catalogue can never be ordered, and trying wipes the customer's cart.** Product 49 has `regular_price = 4999.00` but `selling_price = NULL` (1 of 35 live products). `getCart` aliases `p.selling_price AS price`, so the row arrives with `price: null`; `createOrder` computes `Number(null) || 0` → `0` and the `.filter(item => item.price > 0 …)` **silently drops it**. Hit while testing AB-42: adding product 49 and checking out returned `{"success":false,"message":"No valid items in cart"}`.<br><br>With that product alone in the cart the order is at least refused. **The dangerous case is a mixed cart:** the order is created from the survivors, `clearCart` then deletes *everything*, and the customer pays for a subset while the dropped item vanishes with no notification. That is exactly `CB-24b`, and this is a live product that triggers it today.<br><br>Two fixes, both needed: reject the whole order when any cart row is invalid (the `CB-24b` code fix, Slice 6), and repair or withdraw product 49 (data). The catalogue is placeholder data due to be replaced at handover — but the same `createProduct` path that produced `AB-14a`'s 29 stock-less products produced this, so the code fix matters regardless of the data. | Slice 6 (`CB-24b`) + set or clear product 49's `selling_price`. | TODO |
| **CB-24b** ✅ **DONE (Phase 5, Slice 6)** — the `.filter(item => item.price > 0 && item.quantity > 0)` is gone. Invalid rows are now **rejected**, never dropped: the handler collects them, returns **400** naming the item (*"Your order was not placed because &quot;X&quot; is not available for purchase right now"*) with an `invalid_items` array, and **leaves the cart untouched** so nothing is lost. **Reproduced before the fix** on real data — a cart holding product 49 (NULL `selling_price`) plus a valid saree produced a **one-item order, an emptied cart, and `"success"`**; the customer would believe they had bought both. **After:** the same cart is refused, **both** items remain, and **no** order is created; a fully valid cart still checks out normally. `Number(null)` is 0 and `Number(undefined)` is NaN, so a missing price now lands in `invalidItems` instead of being rounded away by `\|\| 0`. | `controllers/customerController.js:594-602, :631` | **Cart items are silently dropped from the order, then the cart is wiped.** The `.filter(item => item.price > 0 && item.quantity > 0)` discards any row with a non-positive quantity — which `CB-17` allows anyone to create. The order is still created from the survivors, then `clearCart(user_id)` deletes **everything**, including the dropped rows. **The customer pays for a subset and loses the rest with no notification.** `Number(item.quantity) || 0` also maps `null` → `0`, making a null quantity indistinguishable from a deletion. | Reject the whole order with a clear error if any cart row is invalid. Never silently drop billable items. | TODO |
| **CB-25** | `dbOps/sqlQueries.js:182-197` (`getCart`), `:148-158` (`getWishlist`), `:233-247` (`getOrderItems`) | **Soft-deleted products remain purchasable.** No `p.is_deleted = 0` predicate, while `getProductByIdWithImages` (`:94`) and `getProductsByCategory` (`:121`) **do** filter it. A product deleted while sitting in a cart still appears, still checks out, still reduces stock, still becomes an order line. Soft-delete is not an effective withdrawal control. | Add the filter to all three. Revalidate guest carts against the catalogue on load. | TODO |
| **CB-26** | `controllers/customerController.js:552-561, :344-352`; schema | **Nonexistent `product_id` / `user_id` accepted everywhere.** Only truthiness is validated, and the database provides no backstop — the entire dump contains **exactly one** foreign key (`session_ibfk_1`). `POST /api/cart/add {"user_id":99999,"product_id":99999}` returns 200 and inserts a junk row that then vanishes from `getCart` (the INNER JOIN drops it) — an invisible, unreachable, ever-growing garbage table. | Existence-check before insert, **and** add the FKs (`DB-01`). | TODO |

#### MEDIUM

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **CB-14** | `components/customerLoginManager/customerLoginManager.js:33` | `appConstants` referenced but never imported. On any DB error the catch block throws `ReferenceError`, **destroying the original error**, which surfaces as a 500 with body `{"message":"appConstants is not defined"}`. | Same as `AB-12`. | TODO |
| **CB-15** | `controllers/customerController.js:157` | `res.user_status_id` reads the Express **response** object instead of `result.user_status_id`. Always `undefined`, silently omitted from the JSON. | Fix to `result.user_status_id` — or remove it (see `CB-20`). | TODO |
| **CB-16** ✅ **DONE (Phase 5.5, Slice 2)** — both duplicate pairs removed. ⚠️ **My first sweep check missed this entirely** — a regex assuming 4-space indentation found nothing; re-checking by comparing source occurrences against the parsed object's keys found both. `login.getUserDetails` was declared twice in the same object with identical text, and `order.getOrdersByUser` had a `SELECT *` version shadowed by an explicit-column version. JavaScript keeps the **last** silently, so in each case the earlier definition was dead code that looked authoritative: editing it would have changed nothing, with no error to explain why. **Verified:** a parser-based check now reports zero duplicate keys in either backend. | `dbOps/sqlQueries.js:249` and `:252` (`getOrdersByUser`); `:16` and `:21` (`login.getUserDetails`) | **Two pairs of duplicate object keys.** The second silently wins; the first is dead. Silent shadowing in a query registry is a footgun. | Delete the dead definitions. | TODO |
| **CB-17** ✅ **DONE (Slice 2)** — `quantity` constrained to 1..100. Verified `-5`, `0`, `null`, `2147483647` and `"abc"` all rejected | `controllers/customerController.js:528-536`; `dbOps/sqlQueries.js:199-201` | **No validation on cart quantity.** `cart.quantity` is a signed nullable `int(11)`. Accepts `-5`, `0`, `2147483647`, `null`, `0.5`. Downstream consequence is `CB-24b`. | Phase 3. Also add a stock ceiling. | TODO |
| **CB-18** ✅ **MOOT (Slice 4, Phase 2)** — `getCart` no longer takes `user_id` from the query at all; it comes from the verified session | `controllers/customerController.js:507-523` | `getCart` performs **no** validation on `user_id` (unlike every sibling handler). A missing `?user_id=` yields `undefined` → `NULL` → 0 rows → HTTP 200 `{"data":[]}`, silently masking a client bug. | Phase 3. | TODO |
| **CB-27** 🟡 **MITIGATED (Phase 5.5, Slice 2) — owner chose option C.** The **login** half is fully fixed by `AB-19e` above (216ms → 8ms). The **signup** half stays honest: 409 for an existing email, 201 for a new one. Making the responses uniform was rejected deliberately — it would tell an honest customer who mistyped nothing useful, **and** promise "check your inbox" when there is no mail channel to send through. Instead the rate is what makes bulk probing impractical: **10 per 15 minutes → 5 per hour**, i.e. 40/hour down to 5/hour, an 8x reduction. A real shop signs up a handful of customers a day per IP, so legitimate use is unaffected; **verified** the 5th attempt returns 429 while normal logins are untouched. **The proper fix ships with WhatsApp OTP** (see Deferred work): with a real channel, identical responses become true rather than a lie, and the account's owner gets warned someone probed it. | `controllers/customerController.js:40-45`; `dbOps/customerDbOps.js:50-52` | **User enumeration via two independent oracles.** (a) Signup returns `409 "Email already registered"` on `ER_DUP_ENTRY` vs `201` otherwise — a direct account-existence oracle. (b) Login returns `null` **before** reaching `bcrypt.compare`, giving a ~100× timing delta. (The 401 message body itself is correctly uniform.) | Generic signup response ("if this email is new, check your inbox"). Dummy `bcrypt.compare` on the miss path. | TODO |
| **CB-28** ✅ **DONE (Slice 6)** — bcrypt cost 10→12 for new hashes; min 8 chars; max 72 **bytes** (bcrypt silently truncates past that, so rejecting is honest). Verified: 1 and 7 chars rejected, 8 accepted, 73 bytes rejected, 72 accepted, new hashes are `$2b$12$`, and an existing **cost-10 account still logs in** — bcrypt reads the cost from each hash, so no existing user is locked out. Email-format and field-length validation remain Phase 3. | `controllers/customerController.js:14, :21` | **No password policy.** Only `!password` is checked — `"a"` is accepted. `bcrypt` v6 **truncates at 72 bytes with no error**, so `password.slice(0,72)` authenticates against a 500-character password. No email-format validation and no length pre-checks against `user_name varchar(50)` / `phone_number varchar(15)` / `pri_email varchar(100)` — over-long input yields `ER_DATA_TOO_LONG` → generic 500. | Phase 3 (note the `max: 72` on password). Raise bcrypt cost to 12. | TODO |
| **CB-29** ✅ **DONE (Slice 2)** — same `rejectNonScalarBody` guard on the customer router | all 31 DB calls | **Type confusion.** Because everything uses `pool.query` rather than `pool.execute`, non-scalar body values are serialised by `sqlstring` rather than bound. Verified: an object becomes an `` `ident` = value `` **expression** and an array becomes a comma list, changing the query's shape. `NaN` escapes to the bare token `NaN` → `Unknown column 'NaN'`. `escapeId` keeps this short of arbitrary SQLi, but it yields query-semantics tampering, guaranteed 500s, and a rich error oracle via `CB-12`. | Type-validate all body fields (Phase 3). Migrate to `pool.execute`. | TODO |
| **CB-30** ✅ **DONE (Slice 4)** — login always creates a fresh session; 2-device cap with oldest-first eviction. Verified: device 3 login evicts device 1 (401) while 2 and 3 stay 200 | `components/customerLoginManager/customerAuthManager.js:24, :41-50`; `dbOps/sqlQueries.js:17, :19` | **Concurrent logins clobber each other.** Only the single most-recent session row per email is fetched. Valid-token branch: `result.token` stays `null`, so **no cookie is set at all** and no `session_id` is returned — a second device gets "Login successful" with zero credentials. Expired-token branch: a new token overwrites the shared row, silently invalidating the first device. Effectively one-session-per-user, undocumented and unhandled. | Decide the policy explicitly (per-device sessions recommended) and implement it in Phase 2.1. | TODO |
| **CB-31** ✅ **DONE (Slice 3)** — `reduceStock` computed `Number(product_id)`/`Number(quantity)` and then passed the ORIGINAL un-coerced values to the query, so the bug its own comment described was still live. Now uses the coerced values. | `dbOps/customerDbOps.js:396-405` | **`reduceStock`'s type coercion is dead code.** It computes `const pId = Number(product_id); const qty = Number(quantity);` with the comment *"Force convert to Numbers to prevent string concatenation issues"* — then passes the **original un-coerced** values to the query. `pId`/`qty` are used only in a `console.log`. The bug the author was guarding against is still live. | Use the coerced values in the query. | TODO |
| **CB-32** | `dbOps/customerDbOps.js:418-421`; `dbOps/sqlQueries.js:263-266` | **Multiple `product_stock` rows per product are mishandled.** `getStock` reads `rows[0]` (one arbitrary row) while `reduceStock` decrements **every** matching row. Availability under-reported, inventory over-decremented. | `DB-03` (unique index) + read/write a single row. | TODO |
| **CB-33** | `dbOps/customerDbOps.js:381-388`; `controllers/customerController.js:729-733` | `addOrderItem` awaits the insert but has **no return statement**, so the response always sends `"data": undefined` despite a comment claiming it contains `insertId`. | Moot once `CB-04` deletes the route. Otherwise return the result. | TODO |
| **CB-34** ✅ **DONE (Slice 4)** — empty order history returns `200 {orders: []}` instead of 404 | `controllers/customerController.js:688-693` | `getOrdersByUser` returns **HTTP 404** when a valid user simply has no orders. Wrong semantics, forces the client to treat "no orders" as an error, and adds another has-orders oracle on top of `CB-02`. | Return `200` with `[]`. | TODO |

#### LOW

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **CB-19** | `server.js` | No `helmet`, no `app.disable('x-powered-by')`. | Same as `AB-19`. | **DONE** — helmet 8.3.0, `x-powered-by` disabled, verified live. |
| **CB-20** ✅ **DONE (Slice 4)** — `sid` removed from the login response | `controllers/customerController.js:155` | `sid` (session table PK) returned in the login response. Combined with `CB-24` it narrows an attacker's search space. | Remove from the response. | TODO |
| **CB-35** ✅ **DONE (Phase 5, Slice 3)** — closed as part of `CF-22`. `getNewReleaseProducts` no longer uses `SELECT *`; it names customer-safe columns only, so `is_deleted`, `created_at` and `updated_at` no longer reach a public endpoint. It also gained the product images it never returned. | `dbOps/sqlQueries.js:125-131` | `SELECT *` in `getNewReleaseProducts` returns internal columns (`is_deleted`, timestamps) on a public endpoint. | Project only the needed columns. | TODO |
| **CB-36** ✅ **DONE (Slice 2)** — `:productId` and `:order_id` validated as positive integers. `GET /api/1abc` returned **product 1** before; now 400 | `controllers/customerController.js:264-269` | `GET /api/:productId` passes `req.params.productId` through with no `parseInt`. MySQL coerces, so `/api/1abc` returns product **1**. (`checkWishlist` at `:435-436` is the only handler that correctly parses — the inconsistency is itself notable.) | Phase 3 (numeric coercion on all id params). | TODO |
| **CB-37** | `server.js:28`; `config/db.js:2` | Port `9034` hardcoded. `dotenv.config()` is called only as a **side effect** of `require('./config/db')` — if the require order ever changes, env vars silently vanish. No `app.set('trust proxy')`, no `SIGTERM` handler, no `unhandledRejection` handler. | Explicit `dotenv.config()` at the top of `server.js`; `process.env.PORT`; add the handlers. | TODO |
| **CB-38** | `dbOps/customerDbOps.js:399-400, :406` | Unconditional `console.log` of product IDs, quantities and affected-row counts on **every order**. Log noise and a minor internal-state leak. | Remove or gate behind a debug flag. | TODO |
| **CB-39** | `routes/customerRoutes.js:27` vs `:18, :21, :24` | Route ordering is currently **correct** — but **fragile**: any future single-segment GET added after `/:productId` will be dead. | Move `/:productId` to the end of the file with a comment explaining why. | **DONE — and the trap fired during Slice 2.** `GET /api/verify-token` was added at the end of the file and returned `{"success":false,"message":"Product not found"}`: the catch-all swallowed it. (`POST /logout` was unaffected — `/:productId` is GET-only.) Auth routes moved above the catch-all, and a `⚠️ CATCH-ALL — keep this LAST` warning added at `/:productId`. **Verified:** `/api/verify-token` → 401, `/api/81` → 200, `/api/collections` → 200. |

---

### Admin frontend — `AF-*`

`admin-frontend/admin/src/` unless stated otherwise.

#### CRITICAL

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **AF-01** | `adminDetails.js:1-3` | **Working production admin credentials in plaintext in a public repo.** See `SEC-02`. Note: the file is **never imported anywhere** — it is not a client-side auth mechanism, just a leaked secret. | `SEC-02`. Deleting the file is safe; **rotation is the actual fix.** | **PARTIAL** — file deleted (build verified). ⚠️ The password `paisilks@123` is **still live and still in git history**. Rotation is `SEC-02b` (Phase 2); history purge is pending. |
| **AF-02** ✅ **DONE (Slice 5)** — `ProtectedAdminRoute` now calls `/api/verify-token` (behind `authMiddleware` + `requireAdmin`) instead of reading `localStorage.admin_auth` | `ProtectedAdminRoute.jsx:6-14` | **The only authorization gate in the app is `localStorage.getItem("admin_auth")`.** Typing `localStorage.setItem("admin_auth","true")` in DevTools grants the full admin UI. Combined with `AB-01`, the gate is purely cosmetic. | Phase 2.3 step 4 — verify against the backend. | TODO |
| **AF-15** | all 13 fetch sites | **No `Authorization` header and no `credentials: 'include'` on any request.** Verified by grep. Every admin API call is anonymous. | Phase 2.3 step 1 — **only after** `AB-01` and `AB-02`. See [CONSTRAINT 1](#2-hard-ordering-constraints). | **DONE (Slice 3)** — all 13 calls routed through `apiFetch` in `config/api.js`. Chosen over 13 hand-edits because omitting the option on one future call would silently un-authenticate that request with nothing failing loudly. No `Authorization` header needed — the session is cookie-based. |

#### HIGH

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **AF-04** ✅ **DONE (Slice 6)** — `ContextApp.jsx` **deleted** and unmounted from `main.jsx`. It was mounted around the whole app but consumed by nothing, and its effect wrote `localStorage.setItem("password", ...)` on every page load. It only ever wrote `""`, but it was live code one wiring change away from persisting a real credential. | `ContextApp.jsx:20-21` | **Writes the admin password to localStorage in plaintext.** `main.jsx:10` mounts `LoginDetailsProvider` around the whole app, so this effect runs on **every page load** — it is *not* dead code. It currently writes `""` only because no consumer calls `setPassword`. A latent plaintext-password sink wired into the live app. | Delete the password from the context entirely, or delete `ContextApp.jsx` (nothing calls `useContext` on it). | TODO |
| **AF-05** | `AdminLogin.jsx:60-66` | `admin_auth`, `admin_token`, `admin_user` written to localStorage — XSS-exfiltratable, never expires, and no logout clears them. **`admin_token` is written and never read** (exactly one grep hit in the whole codebase). | Replace with an httpOnly cookie session (Phase 2). Remove `admin_token` from localStorage. | TODO |
| **AF-09** | `AdminHomePage.jsx:91-102`; `DisplayOrderPage.jsx:218` | **Money computed in the browser.** `totalRevenue = parseFloat(p.selling_price) * parseInt(p.total_sold)` and `₹{product.price * product.qty}`. Displayed revenue is not the server's number, so a missing field silently yields `NaN` or a wrong figure a human then acts on. | Backend returns pre-computed revenue and line totals; frontend only displays. | TODO |
| **AF-10**  ✅ **DONE (Phase 5.5, Slice 4)** — the optimistic write is kept (it makes the dropdown feel instant) but the previous status is captured **before** mutating and restored via a `rollback()` on any failure, with the reason shown in a toast. `res.ok` is now checked **before** `res.json()`: parsing first meant an HTML error page or empty body threw past the check into the network catch, so a server that had answered was reported as a network failure. 401 gets its own message. **Verified against the live server:** a bogus order id, an invalid status and a missing session all return messages the UI can now surface, instead of a silent `console.error` leaving "Delivered" on screen while the database said "Pending". | `AdminHomePage.jsx:147-180` | **Optimistic status write with no rollback and no user feedback.** `setOrders` mutates the UI first; on `!res.ok` and on a network throw it **only `console.error`s**. The admin sees "Delivered" while the DB still says "Pending". Worse: `await res.json()` at :171 runs **before** the `res.ok` check at :174, so an HTML/empty error response throws past the check. | Save the previous state, restore it in `catch`, surface a toast. Check `res.ok` **before** parsing. | TODO |
| **AF-16** ✅ **DONE (Slice 5)** — backend returns a consistent `{success}` shape and always issues cookies; frontend gates on `response.ok && data.success`. Verified the FIRST login succeeds and sets `session_id` | `AdminLogin.jsx:57` (with `AB-28`) | **The first login ALWAYS appears to fail.** The frontend gates on `data.validSession`, which the backend returns **only** on the existing-session branch. A genuine first login returns `{sid, message:'Login successful'}` with no `validSession` → falls through to `alert(data.message)` at :72, which pops **"Login successful" as an error** and keeps the admin on the login page. Attempt 2 (within a day) then finds the session and "succeeds". **Login requires pressing the button twice.** | Fix both halves: `AB-28` (always issue a full cookie set) and gate the frontend on `res.ok` + an explicit success field. | TODO |
| **AF-17** ✅ **DONE (Phase 5, Slice 1)** — `./columns` → `./Columns`. Only one site remained; the `OrderedProducts` copy went with that folder in Phase 0. **Proved rather than reasoned about:** built the admin frontend on a genuinely case-sensitive APFS volume (verified case-sensitive by creating `A` and testing for `a`). With the original import it failed with `Could not resolve "./columns" from "src/components/RecentOrders/RecentOrders.jsx"`; with the fix, `✓ built`. Also swept **every** relative import in both frontends against the real on-disk filenames — zero remaining mismatches, so this class of bug is closed, not just this instance. `DEP-12` (CI on Linux) is what stops it recurring. | `components/RecentOrders/RecentOrders.jsx:3`; `components/OrderedProducts/OrderedProducts.jsx:3` | **Case-mismatched imports will break any Linux/CI build.** `import {columns} from "./columns"` — the actual file is `Columns.jsx`. Works on this case-insensitive macOS APFS volume; **fails hard on Vercel/Netlify/Docker** with "Failed to resolve import". | Fix the casing to `./Columns`. Add a CI build step on Linux so this class of bug is caught. | TODO |
| **AF-18** ✅ **DONE (Slice 6)** — price/stock inputs are now `type=number min=0 step=0.01`, plus a `validateProduct()` gate before submit (required name, non-negative prices, `selling <= regular`, integer stock). Server re-validates independently (Slice 3), so this is feedback rather than the boundary | `components/AddProduct.jsx:82-107, :101-103, :420, :437`; `components/UpdateProduct.jsx:89-98, :124-126` | **Product form validates only `name`.** The price `Input`s have **no `type="number"`, no `min`, no `step`** — they are text fields. `regular_price: Number(newProduct.regularPrice) || 0` means `"abc"` → **price 0, product published free on the storefront**. `"-500"` → negative price persisted. `selling_price > regular_price` is never compared. Empty stock → 0. Empty category → the literal string `"UNCATEGORIZED"`. Identical gap on create **and** update. No validation on either side of the wire. | Client: `type="number"`, `min="0"`, `step="0.01"`, required-field checks, `selling <= regular` comparison. Server: Phase 3. | TODO |
| **AF-19** | `AdminHomePage.jsx:284`; `components/AllProducts.jsx:72` | **Every destructive admin action is gated by `window.confirm` alone.** With `AB-01` unresolved, `curl -X DELETE .../api/delete-product/1` is the entire attack. Every "admin capability" in this app is gated purely in UI. | Real server-side authorization (Phase 2). | TODO |

#### MEDIUM

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **AF-03** | `AdminLogin.jsx:54`; `AdminHomePage.jsx:106, 118, 121, 152, 172`; `AllProducts.jsx:16, 19`; `UpdateProduct.jsx:65, 137, 139, 143, 157`; `AddProduct.jsx:110, 136, 139, 165, 171`; `DisplayOrderPage.jsx:21` | **18 `console.log`/`warn` sites leaking full order and customer PII plus product payloads** (of 31 total `console.*` calls). `AdminLogin.jsx:54` logs the entire login response including the token. | Delete all 18. Keep only guarded `console.error` for genuine failures. | **DONE** — 31 → 13 `console.*` calls. All 18 leaking sites removed, including the full login response with token (`AdminLogin`), the complete order dump with customer names and addresses (`AdminHomePage`, `DisplayOrderPage`), and every FormData field with prices (`UpdateProduct`). The one surviving `console.warn` was rewritten to a static string with no payload. 12 `console.error` calls kept — genuine failure logging, no data. Build verified. |
| **AF-06** ✅ **DONE (Slice 5)** — Logout wired to `POST /api/logout`, clears local hints and redirects. Styling fixed (`bg-[]` was an invalid Tailwind class emitting nothing) | `AdminHomePage.jsx:468` | `<button className="bg-[]">Logout</button>` — **no `onClick`, no handler anywhere.** There is no way to log out; `admin_auth` persists forever on a shared machine. `bg-[]` is also an invalid Tailwind arbitrary value that emits no class. | Wire it: call the new logout endpoint, clear localStorage, navigate to `/`. Fix the class. | TODO |
| **AF-07** | `AdminHomePage.jsx:36, :86`; `AddProduct.jsx:61` | **Two hardcoded backend origins and no config layer.** 10 calls to `pai-silks-website.onrender.com`, 2 to `pai-silks-website-1.onrender.com` — i.e. **the admin panel calls the *client* backend** for bestsellers and collections (a real cross-service dependency, not a typo). `const API_BASE` at :36 is declared and **never used**. No `.env`, no `import.meta.env` anywhere (verified). Changing a domain requires editing 12 files. | Introduce `VITE_ADMIN_API_BASE` and `VITE_CLIENT_API_BASE`; replace all 12 literals. Decide whether the admin panel *should* call the client backend at all. | **DONE** — all 14 URLs now via `src/config/api.js`; dead `API_BASE` removed. Cross-call to client backend preserved deliberately (behaviour unchanged); re-pointing is `CF-22`, Phase 5. |
| **AF-08**  ✅ **DONE (Phase 5.5, Slice 4)** — both `localStorage.setItem("categoryProducts", ...)` writes removed. Nothing ever read the key back — `AdminHomePage` carried only a comment noting its reader had been deleted — so product data including prices and stock accumulated in the browser indefinitely with no invalidation.<br><br>⚠️ **Residual, deliberately not expanded into here:** the `categoryProducts` **React state** in `AdminHomePage.jsx:31` is now written by both product forms and **read by nothing** — the same write-only pattern one level up. Harmless (in-memory, cleared on reload) but it is dead weight that looks live. Removing it means dropping the state, the prop and both `setCategoryProducts` call sites; scheduled for Phase 6 hygiene. | `AddProduct.jsx:190`; `UpdateProduct.jsx:199` | `localStorage.setItem("categoryProducts", …)` is a **write-only cache** — nothing reads it anywhere (`AdminHomePage.jsx:79` is only a comment noting the reader was removed). Product data with prices and stock accumulates unbounded with no invalidation. | Delete both writes. | TODO |
| **AF-11** | `components/ImageUpload.jsx:18-33` | **Entirely fake progress bar.** A `setInterval` increments a counter 0→100 over ~3 s with **zero network activity**, then calls `onImageUpload(file)`. The real upload happens later in the parent. Consequences: "Upload Complete ✅" is a lie; a user who submits within 3 s **silently loses images**; the `interval` is never cleared on unmount → leak + setState-after-unmount. | Drive the bar from a real `XMLHttpRequest` `upload.onprogress`, or remove it and show an indeterminate spinner. Clear the interval in cleanup. | TODO |
| **AF-12**  ✅ **DONE (Phase 5.5, Slice 4)** — **both halves, and the finding understated one of them.** `UpdateProduct` created a blob URL per preview and **never revoked** it, leaking until the tab closed. But `AddProduct` was not the correct counter-example: its cleanup was keyed on `[previewUrls]`, so it ran on **every** change and revoked the **previous** array's URLs — which were still rendered. Adding a second image broke the first thumbnail.<br><br>Both now track created URLs in a `useRef` and revoke once, on unmount. A ref rather than state because the cleanup must not re-run when the list changes. Tracking creations separately also means a URL dropped by the `.slice(0, 4)` cap is still released, and — in `UpdateProduct`, where `previewUrls` also holds the product's existing **https** URLs from the server — only genuine blob URLs are revoked. | `AddProduct.jsx:43-47`; `UpdateProduct.jsx:79` | **Blob URL revoked while still rendered.** The cleanup is keyed on `previewUrls`, so it fires on **every change**, revoking the *previous* array's URLs — which are still rendered at `:458-467`. Add image #2 and image #1's thumbnail breaks. `UpdateProduct` has the mirror bug: it calls `createObjectURL` and **never** revokes → unbounded blob leak. | Revoke only on unmount, or track and revoke individual removed URLs. | TODO |
| **AF-13**  ✅ **DONE (Phase 5.5, Slice 4)** — `.catch` added and the result defaulted to `[]`. Without it, any network failure or non-JSON response (a 401 HTML page, a Render cold-start error page) was an unhandled rejection; worse, `data.success && setCollections(data.data)` could set `undefined`, after which `collections.map` threw during render and white-screened the whole Add Product page. It now degrades to an empty dropdown. | `AddProduct.jsx:60-65, :305` | The collections fetch is `.then().then().finally()` with **no `.catch`** → unhandled rejection on any network/non-JSON failure. And `data.success && setCollections(data.data)` can set `undefined`, so `collections.map(...)` at :305 throws during render and **white-screens the Add Product page**. | Add `.catch`; default to `[]`; guard the map. | TODO |
| **AF-20** ✅ **DONE (Phase 5, Slice 2)** — pulled in because it **blocked** the owner's sort feature: a sort dropdown would have been as inert as the headers already were. `onSortingChange`, `onColumnFiltersChange`, `onColumnVisibilityChange`, `onRowSelectionChange` registered and `getSortedRowModel()` added (it was already imported and never used). `columnVisibility` initial value corrected from `[]` to `{}` — it is a `Record<columnId, boolean>`, and an array is truthy but carries no column keys, so lookups silently missed. `DataTable` also gained **optional** controlled-sorting props so the dropdown and the column headers drive one shared TanStack state rather than two competing mechanisms; uncontrolled callers are unaffected. This restores clicking-to-sort, the row-select checkboxes and the Columns dropdown, all of which silently ignored the user. | `components/RecentOrders/Data-table.jsx:40-63, :36` | **TanStack tables are fully controlled with no change handlers — everything is inert.** `state` is passed but only `onGlobalFilterChange` is registered. Missing `onSortingChange`, `onColumnFiltersChange`, `onColumnVisibilityChange`, `onRowSelectionChange`, and `getSortedRowModel`. So on the main orders table: every `ArrowUpDown` sort header does nothing, the row-select checkboxes never check, the Columns dropdown never hides a column. `columnVisibility` is also initialised to `[]` (an array) instead of `{}`. | Register all handlers and add `getSortedRowModel`. Fix the initial value. | TODO |
| **AF-21**  ✅ **DONE (Phase 5.5, Slice 4)** — the panel headed **"⚠️ Tips for Exact Matching"**, which explained strict category matching and listed every category name in the database, is gone along with the `debugLog` state that fed it. Developer scaffolding that was being shown to the shop owner in production. | `components/AllProducts.jsx:14-26, :28-30, :121-126` | Fetches the **entire product catalogue** and filters client-side, so every category click re-downloads everything. Worse, it stashes **every category name in the database** into `debugLog` and renders it to screen under an "⚠️ Tips for Exact Matching" **debug panel shipped in production**. | Server-side filtering + pagination. Delete the debug panel. | TODO |
| **AF-22**  ✅ **DONE (Phase 5.5, Slice 4)** — `AbortController` added to the `AllProducts` category fetch, with the signal passed through `apiFetch` (which spreads its options into `fetch`). Without it, switching category A → B quickly let A's slower response land **after** B's and overwrite it, leaving the admin looking at category B with category A's products. An `AbortError` is treated as expected rather than logged as a failure, and the `finally` no longer clears a `loading` state belonging to the request that superseded it. | `AdminHomePage.jsx:69, :86, :115`; `AllProducts.jsx:14`; `AddProduct.jsx:61` | **No `AbortController` on any of the 6 effect fetches.** `AllProducts` re-fetches on `[categoryName]` with no cancellation, so switching category A→B quickly lets A's slower response overwrite B's list. `setLoading(false)` in `finally` also fires after unmount. | Add `AbortController` + cleanup to every effect fetch. | TODO |
| **AF-23**  ✅ **DONE (Phase 5.5, Slice 4)** — `loading` now starts **false** and is set true only when a fetch actually begins. It started `true` while the fetch was gated on `if (categoryName)`, so rendering without a category — which `AdminHomePage` does, its initial state being `""` — meant no fetch ever started, nothing cleared the flag, and the page showed "Loading..." permanently with no data, no error and no way back. The empty state now reads "Select a category to see its products." | `components/AllProducts.jsx:6, :68, :99` | **Can hang on "Loading…" forever.** `loading` starts `true`, but the fetch is gated on `if (categoryName)` — and it is rendered with `categoryName=""` (`AdminHomePage.jsx:194`, initial state `""` at :30). The early return at :99 renders `Loading...` permanently, with no escape and no Back button. | Only set `loading` when a fetch actually starts; render an empty state otherwise. | TODO |
| **AF-24**  ✅ **DONE (Phase 5.5, Slice 4)** — the body is now exactly `{ order_id, status }`, matching what the controller destructures. It had sent **six** keys for two values (`id`/`orderId`/`order_id`, `status`/`status_of_order`/`order_status`) because the API contract was unknown when it was written. Verified the two-field body updates an order successfully. | `AdminHomePage.jsx:160-167` | **Shotgun payload:** six keys sent for two values (`id`/`orderId`/`order_id`, `status`/`status_of_order`/`order_status`) because the backend contract was unknown. If the backend ever reads two of them differently, behaviour is undefined. | Send exactly the two fields the API reads. | TODO |
| **AF-25**  ✅ **DONE (Phase 5.5, Slice 4)** — **three bugs in one line.** (1) `event.stopPropagation()` referenced an **undeclared global**, resolving to `window.event`, which only Chrome provides — Firefox and Safari threw `ReferenceError` and the copy never ran. (2) The `alert` fired **first**, so it announced success before that throw: Firefox users were told the ID was copied when nothing had been. (3) It copied `payment.id`, the ORDER id, while labelling it a payment ID — this object carries no payment id at all.<br><br>Fixed by extracting the cell into a real `RowActions` component: TanStack calls `cell` as a plain function, so a hook there would be a hook outside a component. Now takes the event as a parameter, copies the order id, awaits the clipboard promise, and reports success **or** failure honestly — `navigator.clipboard` genuinely fails on plain http and in some browsers. Two dead menu items ("View customer", "View payment details", neither with an `onClick`) removed rather than left looking functional. | `components/RecentOrders/Columns.jsx:187` | **`event` is an undeclared global** in the copy-payment-ID handler — it resolves to `window.event`, which is Chrome-only. In Firefox/Safari it throws `ReferenceError`, so `navigator.clipboard.writeText` **never runs** while the alert already claims success. The ordering is also wrong (alert before `stopPropagation`), and it copies `payment.id` (the order id) while labelling it a payment ID. | Accept `(e)` as a parameter; reorder; fix the label. | TODO |
| **AF-14** | `RecentOrders.js:1-80` | Mock orders with **real-looking phone numbers**, reachable via `OrderedProducts/OrderedProducts.jsx:10`. See `SEC-04`. | `SEC-04`. | TODO |

#### LOW

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **AF-26** | `AdminLogin.jsx:138` | "Keep me logged in" `<Checkbox defaultChecked />` has no `name`, no `checked`, no `onChange`, and is not referenced in `loginCheck`. Purely decorative and misleading. | Wire it or remove it. | TODO |
| **AF-27** | `App.jsx:2` | Imports `./assets/react.svg`, **which does not exist**. Dead today (no importer), but the build dies if it is ever imported. `useState`, `reactLogo`, `viteLogo` are all unused. | Delete `App.jsx` and `App.css`. | TODO |
| **AF-28** | `components/OrderedProducts/*` (3 files) | Dead — never imported. If mounted, `Data-table.jsx:117` would throw `displayOrderPage is not a function` (the prop is never passed) and `alert(row.original)` renders `[object Object]`. | Delete the folder. | **DONE** in Phase 0 — pulled forward because it was the only other importer of `src/RecentOrders.js`, so `SEC-04` could not be completed without it. |
| **AF-29** | `DisplayOrderPage.jsx:20-22` | `useEffect(() => { console.log("order is", order); }, [])` reads `order` with an empty dep array — a stale closure logging only the first order ever selected. | Delete the effect. | TODO |
| **AF-30** | `AdminHomePage.jsx:16, :459, :463`; `AddProduct.jsx:494`; `RecentOrders/Columns.jsx:192-193`; `DashBoard.jsx:137-139`; `DisplayOrderPage.jsx:226, :39` | **Non-functional UI shipped as if it worked:** `notifications = 3` hardcoded driving a permanent red badge; bell `onClick={() => alert("Go to OrderSection")}`; an "Update" button whose handler is `alert("Update logic not implemented yet")`; "View customer"/"View payment details" menu items with no `onClick`; "View All" is a `<div>` with no handler; `colSpan={6}` under an 8-column table misaligns the Total row; a heading that literally reads `OrderDetails2`. | Implement or remove each. Do not ship dead affordances. | TODO |
| **AF-31** | `AddProduct.jsx:49-58` | A child component writes `document.body.style.overflow` directly, fighting the app shell's own scroll containers (`AdminHomePage.jsx:471-474`). On an early unmount it can leave the page permanently scroll-locked. | Lift to the shell, or guarantee restoration in cleanup. | TODO |
| **AF-32** | `tailwind.confing.js`; `components.json:7` | **Filename is misspelled ("confing")**, it uses `module.exports` inside a `"type":"module"` package (would throw if Node loaded it), and `components.json` sets `"config": ""`. So it is **never loaded** — the `primary` colour it defines is never registered, which is why `bg-primary` resolves to the near-black `--primary` CSS var from `index.css` instead of the brand colour. | Delete it (Tailwind v4 does not want a JS config) and define the theme in `index.css`. | TODO |
| **AF-33** | `eslint.config.js:26` and 9 sites | **`npm run lint` cannot be passing.** `'no-unused-vars': ['error', …]` with standing violations: `AdminHomePage.jsx:5` (`productData.json` — a 2-line `{"categories": []}` stub that still ships), `:36` (`API_BASE`), `:24` (`categoryProducts`), `RecentOrders.jsx:4`, `AddProduct.jsx:7` and `:150`, `UpdateProduct.jsx:5`, `App.jsx:1-3`, `Data-table.jsx:14`. | Fix the violations; add lint to CI. | TODO |
| **AF-34** | `package.json` | Unused: `@radix-ui/react-icons` (the app uses `lucide-react` exclusively). Redundant: `autoprefixer` + `postcss` alongside `@tailwindcss/postcss` (v3-era leftover — Tailwind v4 prefixes internally). No `react-scripts` leftovers (clean). Versions are current-generation with no obviously vulnerable pins. | Remove the two unused/redundant entries. Run `npm audit`. | TODO |
| **AF-35** | `index.html:5, :6` | No CSP meta tag, no `referrer` policy. Favicon points at a `./src/` path. Google Fonts loaded from a third-party origin with no SRI and no `preconnect`. | Add CSP + referrer policy; move the favicon to `public/`. | TODO |
| **AF-36** | `.gitignore` | **Has no `.env` entry**, and there is **no repo-root `.gitignore`**. `*.local` catches `.env.local` by luck of the glob, but `.env`, `.env.production` and `.env.development` are unprotected. This is the exact gap that leaked the Cloudinary secret, still armed. | `SEC-01` step 3. | **PARTIAL** — `admin-frontend/admin/.gitignore` now ignores `.env` / `.env.*` while keeping `.env.production` + `.env.example` tracked (verified with `git check-ignore`). **Repo-root `.gitignore` and both backend `.gitignore` files still TODO under `SEC-01`.** |
| **AF-37** | dead files | `App.jsx`, `App.css`, `adminDetails.js`, `components/OrderedProducts/*`, `productData.json`, `RecentOrders.js`, `AdminLogin.css` (imported but its selectors match no element), `tailwind.confing.js`, and 8 unreferenced assets (`assets/svg/AllProducts.svg`, `DashBoard.svg`, `delete.svg`, `Notifications.svg`, `OrderList.svg`, `SareeImage.png`, `UpperArrowMark.svg`, `assets/png/DemoSaree.png`). | Delete. | TODO |

#### Crash-on-undefined (admin frontend)

| ID | Location | Trigger | Blast radius |
|---|---|---|---|
| **AF-C-F1** | `AdminHomePage.jsx:138` | `o.product_list.map(...)` — any order row lacking `product_list` | **Highest risk.** Throws inside `normalizeOrders`; swallowed by `.catch` at :124, so **the order list silently never loads** and the dashboard just looks empty with no error. |
| **AF-C-F2** | `AddProduct.jsx:305` | `collections.map` on `undefined` | White-screens the Add Product page (see `AF-13`). |
| **AF-C-F3** | `DisplayOrderPage.jsx:192` | `order.product.map` — **unguarded**, unlike the sibling at `:107` which correctly checks `Array.isArray`. The `RecentOrders.js` mock shape has `product` as a *string*. | Entire order-detail page throws. Same object, two different assumptions, 85 lines apart. |
| **AF-C-F4** | `UpdateProduct.jsx:58-60` | `typeof null === 'object'` → `null.image_url` | Kills the update form's init effect. |
| **AF-C-F5** | `AdminHomePage.jsx:91` | `data.data.map` on `{success:true}` without `data` | Swallowed; best-sellers silently empty. |
| **AF-C-F6** | `AdminHomePage.jsx:120, :128` | `normalizeOrders(res.data)` when `res.data` is not an array | Swallowed by `.catch`. |
| **AF-C-F7..F11** | `DisplayOrderPage.jsx:218`; `RecentOrders/Columns.jsx:162-166`; `OrderedProducts/Columns.jsx:109-113`; `DashBoard.jsx:123-127` | Missing/non-numeric money fields | Renders **`₹NaN`** to the admin. 5 sites. |
| **AF-C-F12** | `DisplayOrderPage.jsx:172` | `new Date(undefined)` — unguarded, whereas `:59-63` guards | Renders the literal "Invalid Date". |
| **AF-C-F13** | `RecentOrders/Columns.jsx:69`; `OrderedProducts/Columns.jsx:55` | `products[0].name` — guarded for array-ness but not element type; a `null` first element throws | Cell throws. |

> **Note:** `DashBoard.jsx:11-16, 21-23` is the one place in this app that gets it right — default param `orders = []` plus optional chaining. Use it as the pattern.

> **XSS: clean.** Verified zero `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `eval(`, `new Function`, `document.write`, `insertAdjacentHTML`, `javascript:`. API data reaches only `<img src>`, which is not a script sink. No user-controlled `href` anywhere. **No Cloudinary key, API key, or unsigned upload preset exists in the frontend** — uploads correctly go through the backend. This is the one thing this app gets right, and it must stay that way.

---

### Client frontend — `CF-*`

`client-frontend/client/src/` unless stated otherwise.

#### CRITICAL

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **CF-01** ✅ **DONE** | `Checkout.jsx:131` | **Every order is written to the database as fully paid with ₹0 collected.** `payment_status: "Paid"` is hardcoded, and the backend trusts it (`CB-03`). Verified: **zero** Razorpay integration anywhere — no `Razorpay` constructor, no `checkout.razorpay.com` script, no `rzp_` key, no verification call. The only occurrences of the word are a Zod literal (`:35`), a default value (`:58`) and a radio label (`:329-332`). `index.html` loads no payment SDK. The button says **"Pay Now"** (`:346`) and takes no payment. This is not tampering — it is the **shipped default for every customer**, and it can be looped to drain inventory since `reduceStock` runs at `customerController.js:627`. | **Immediate (1 line):** change to `payment_status: "Pending"` and let the backend server-assign it (`CB-03`). **Later:** integrate Razorpay per [Deferred](#13-deferred-work) — mark paid only after server-side signature verification. | TODO |
| **CF-02** ✅ **DONE** | `CartContext.jsx:78-101` (esp. `:86-96`) | **DUPLICATE-ROW OVER-BILLING — customers are charged N× what the UI shows.** The dedup guard lives **inside** `setCartItems`, but the DB `POST /api/cart/add` fires **outside** it, on every click. The backend SQL is a bare `INSERT` with `quantity` hardcoded to 1 and no upsert (`CB-22`), and there is no unique index (`DB-02`). **Failure scenario:** a logged-in user clicks `+` on a ProductCard 5 times (`ProductCard.jsx:115` → `App.jsx:212`, which has **no `isInCart` guard at all**). Local state dedups to 1 line item showing ₹2,999. The DB cart now has 5 rows. `createOrder` bills from the DB cart → **the customer is charged ₹14,995 and shown ₹2,999.** Also reachable via `WishList.jsx:82-84` (`handleAddAllToCart` loops regardless of membership) and `LoginPage.jsx:66-78` (guest merge re-POSTs every item). `handleAddToWishList` (`:104-128`) has the identical structure → duplicate wishlist rows. | Move the `fetch` **inside** the dedup branch so it fires only on a genuine addition. Add an `isInCart` guard to `ProductCard`/`App.jsx:212`. Fix `CB-22` + `DB-02` in the same change. | TODO |
| **CF-05** ✅ **DONE (Slice 4)** — no request sends `user_id` any more; 10 body fields and 5 URL params removed | 9 call sites: `CartContext.jsx:13, 79, 105, 134, 158`; `Cart.jsx:34, 88`; `WishList.jsx:30, 78`; `MyOrders.jsx:125`; `MyProfile.jsx:45, 99`; `Checkout.jsx:82, 115` | **Complete IDOR — `user_id` from localStorage is the only identity.** Verified: **zero** occurrences of `credentials`, `Authorization`, `Bearer`, `withCredentials`, `document.cookie`, or `token` across all 43 source files. Setting `localStorage.user_id = 7` in DevTools and reloading yields, **with no password**: the victim's full order history with addresses and payment status (`MyOrders.jsx:138`), their name/email/phone/address (`MyProfile.jsx:54`), full read/write of their cart and wishlist, and the ability to **place orders as them** (`Checkout.jsx:115`). | Phase 2.2 + 2.3. Cannot be fixed in the frontend alone. | TODO |

#### HIGH

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **CF-04** ✅ **DONE (Slice 3)** — all 26 calls now go through `apiFetch`, which sets `credentials:'include'`; full cookie round trip verified | `LoginPage.jsx:42-49` | **The session mechanism is never even established.** The login `fetch` omits `credentials`, and the request is cross-origin, so the browser **refuses to store the four `Set-Cookie` headers** the backend emits at `customerController.js:120-158`. None of the 26 fetches uses `credentials` either. `localStorage.setItem` is called exactly three times in the whole app (`user_id`, `user_name`, `user_email` at `:57-59`) plus `cart`/`wishlist`. **Authentication in this application is a plaintext integer in localStorage that the user can edit.** Logging out (`ProfileSection.jsx:28-42`) never invalidates a server session because none was ever established. | Phase 2.3 step 1 — **only after** `CB-01` and `CB-07`. See [CONSTRAINT 1](#2-hard-ordering-constraints): adding `credentials` first turns this into a universal CSRF hole. | TODO |
| **CF-03** ✅ **DONE** | `Cart.jsx:186-187, :191`; `Checkout.jsx:130, :378, :383` | **₹99 shipping exists only in JSX.** `Checkout.jsx:130` sends `total_amount: localTotal + 99`, and `customerController.js:579` **never destructures `total_amount`** — the server computes `Σ(selling_price × quantity)` with **no shipping term**. **Every order record is short by ₹99.** The merchant under-collects on 100% of orders and no invoice will reconcile with what the customer was shown. | Decide one authority. Either send shipping as a distinct server-validated field and have the server add it, or stop displaying it. Then display the **server-returned** `total_amount` on the confirmation screen. | TODO |
| **CF-06** ✅ **DONE (Phase 5, Slice 1)** — ⚠️ **this row was previously marked "DONE (Slice 6)" and was NOT done.** That tick referenced `CF-09`, the checkout *phone* fix; the two were conflated because both touch phone numbers. The missing route was never built, so profile editing stayed a permanent no-op through Phases 3 and 4 while the register claimed otherwise. Recorded here rather than quietly re-ticked.<br><br>**Built now:** `PUT /api/update-profile` — validator (`v.updateProfile`) → `authMiddleware` → controller → manager → dbOp → SQL. The controller reads exactly `name`, `phone`, `address`; `pri_email` is **not** updatable (UNIQUE column with a denormalised copy in `session.pri_email` — changing it is the `SEC-02b` procedure, not a profile edit), matching the UI, which already renders the email input disabled. Frontend stopped sending `{...user}` and now names the three fields, renders the server's echoed row rather than its optimistic copy, and surfaces the real validation message instead of a flat "Failed to update profile". **Verified:** valid update persists; India E.164, USA E.164 and legacy bare 10-digit numbers all accepted; empty name, 51-char name, `"abc"` phone, `+91` starting `1`, and 501-char address all rejected 400; a body carrying `pri_email`/`role_id`/`is_delete`/`user_id` changed **none** of them and left the targeted user untouched; anonymous → 401; soft-deleted → 403. | `MyProfile.jsx:103-112` | **`PUT /api/update-profile` does not exist.** Verified against the complete 23-route table — there is no `update-profile` route and **no `PUT` route of any kind**. The request 404s, `response.json()` at `:114` throws on the HTML body, and the user gets `alert("Network error")`. **Users can never change their phone or address.** | Add a real `PUT /api/profile` endpoint (authenticated, ownership-checked) and point the frontend at it. Until then, disable the button rather than lying to the user. | TODO |
| **CF-07** ✅ **DONE** (backfill `DB-04` still pending) | `Checkout.jsx:133` | **Every order is stored with `status = NULL`.** The frontend sends `order_status: "Pending"`; the API destructures `status`. `status` is therefore `undefined` and `pool.query` escapes it to `NULL`, **overriding the column DEFAULT** (`CB-23`). `MyOrders.jsx:10` masks it with `|| "Pending"`, so orders display "Pending" forever and the admin panel has no real status to sort or filter on. | Rename the payload key to `status`. Backfill via `DB-04`. Validate against the enum (Phase 3). | TODO |
| **CF-09** ✅ **DONE (Slice 6)** — all three defects fixed: `phoneNumber` added to the Zod schema **and** `defaultValues` (it was stripped by `zodResolver` before); submit reads `data.phoneNumber` instead of the nonexistent `data.phone`; and the autofill block now reads `response.orders` rather than `response.data`, which was always undefined and made the whole block unreachable. **Extended beyond the plan:** an India/USA country selector was added at the owner's request, and numbers are stored in E.164 | `Checkout.jsx:26-37, :260, :128, :88-107` | **The checkout phone number is always `"9999999999"` — three independently fatal defects stacked.** (1) `checkoutSchema` has **no** `phoneNumber` and no `phone` key, and `zodResolver` + `z.object` **strips unknown keys**, so the rendered `name="phoneNumber"` field never survives parsing. (2) `onSubmit` reads `data.phone` — a name in neither the schema nor the form → unconditionally `undefined` → the `"9999999999"` fallback on **100% of orders**. (3) The autofill meant to populate it checks `response.success && response.data`, but `GET /api/orders/user/:id` returns `{success, orders}` — **so the entire block is unreachable**; and even if it ran it reads `lastOrder.customer_name`/`.email`/`.phone_number`, none of which are in the `SELECT`, and `form.setValue("phone", …)` targets a nonexistent field. **Net effect: the merchant cannot phone any customer about any order.** Also, `phoneNumber` is absent from `defaultValues` (`:49-60`), so the input mounts `value={undefined}` — an uncontrolled→controlled transition that logs a React warning and can drop the first keystroke. | Add `phoneNumber` to the schema **and** `defaultValues` with a 10-digit regex; read `data.phoneNumber`; fix or delete the dead autofill; add the missing columns to the API `SELECT` if autofill is wanted. | TODO |
| **CF-10** ✅ **DONE** | `CartContext.jsx:60-61` | **One corrupt localStorage key permanently bricks the site for that visitor.** `JSON.parse(localStorage.getItem("cart"))` has no try/catch and runs inside the provider's mount effect, which wraps the **entire** application (`main.jsx:12-14`). Verified: **no `ErrorBoundary`, no `componentDidCatch`, no `errorElement` anywhere in `src/`.** One truncated write (quota exceeded, a browser extension, DevTools poking) → blank page on **every** route, with no in-app recovery. `|| []` guards `null` but not a throw. | **Highest-leverage fix in the entire audit:** add one `ErrorBoundary` around `<AppRouter />` in `main.jsx` (~15 lines) — it converts **seven** blank-page outages (`CF-C-F1..F7`) into a degraded-but-usable page. Also wrap both `JSON.parse` calls in try/catch. | TODO |
| **CF-08** ✅ **DONE (Phase 5, Slice 1)** — the three parts left open after Slice 4 are now closed. **(b)** `path="*"` → a real `NotFound` page carrying Header and Footer, so an unmatched URL is a recoverable dead end rather than a blank white screen. **(c)** `/animation` deleted — it published `PeacockLoader` as a public page that rendered a fullscreen spinner which never resolved, with no navigation. *The component itself is untouched and still used by `Homepage` (×2), `App` and `ViewProductPage`; only the route went.* **(d)** `/forgot-password` now exists. Deliberately **not** a self-service reset: that needs SMTP credentials, a sender domain and an expiring single-use token table, none of which are configured, and a form that silently did nothing would be worse than the blank page — the customer would believe an email was sent. The page states the position plainly and routes to the shop's real contact details (the footer's `paisilks@gmail.com` / `+91 98745 60759`). Real reset is logged under Deferred work. | ~~PARTIAL (Slice 4)~~ — `PrivateRoute` added on `/my-orders`, `/my-profile`, `/checkout`, verifying against the server rather than localStorage. **Still TODO:** the missing 404 catch-all, the dead `/forgot-password` link, and the `/animation` demo route | `Approuter.jsx:16-27`; `LoginPage.jsx:237-242` | **No route protection, no 404, a dead link, and a dev demo in production.** Ten flat `<Route>` elements, zero guards, zero `<Navigate>`, no `path="*"`. (a) `/my-orders`, `/my-profile`, `/checkout` render for anyone; `/checkout` reaches `onSubmit` before its `!userId` check at `:117`. (b) **No `path="*"`** → any typo'd URL renders a completely blank white page with no header, no footer, no way back. (c) `:24` ships `/animation` — a fullscreen loading-spinner demo — as a public production page. (d) `LoginPage.jsx:238` links to `/forgot-password`, **which has no route** → clicking "Forgot Password?" gives a blank white screen. Combined with the missing 404 this is a **total dead end for locked-out customers**. | Add `path="*"` with a real 404 page; add `PrivateRoute` guards; implement `/forgot-password` or remove the link; delete `/animation`. | TODO |
| **CF-11**  ✅ **DONE (Phase 5.5, Slice 5)** — `signOut` in `AuthContext` clears `wishlist` alongside `cart`, `user_id`, `user_name` and `user_email`, and — more importantly — calls `POST /api/logout` first, so the **server** session actually ends. Clearing localStorage never ended anything; it only hid the session from that tab. Also removed the `window.location.reload()`, which ran synchronously in the same handler BEFORE React could commit the state clears, making them pointless. | `ProfileSection.jsx:28-42` | **The previous user's wishlist leaks to the next user on a shared device.** Logout removes `user_id`, `user_name`, `user_email`, `cart` — but **not `wishlist`**. `CartContext.jsx:69-74` writes `wishlist` unconditionally (including for logged-in users), and the guest branch at `:61` reads it back. The next visitor sees the previous customer's saved items — names, prices, images. Worse, the `setWishListItems([])` at `:35` cannot save it: `window.location.reload()` at `:41` runs synchronously in the same handler, **before React commits** and before the sync effect can run. | Clear `wishlist` too. Remove the synchronous reload, or clear localStorage directly before reloading. | TODO |
| **CF-12**  ✅ **DONE (Phase 5.5, Slice 5)** — both index-keyed handlers now guard the stale index **and** match by `product_id` rather than position. The cart one was actively dangerous: `dynamicCartItem[index]` could be `undefined`, and `{ ...undefined, quantity: n }` yields `{ quantity: n }` — a nameless, **priceless** row inserted into the cart and then persisted to localStorage by the context's sync effect. | `Cart.jsx:33-53`; `WishList.jsx:29, 47` | **Stale array index injects a phantom cart row and then throws.** `index` is the render-time array index. If the array shrinks between render and click (an item removed, or the async context refetch landing), `dynamicCartItem[index]` is `undefined`: line 39 spreads `undefined` and **silently inserts a priceless, nameless phantom row `{quantity: n}` into global state — which `CartContext.jsx:71` then persists to localStorage** — and line 53 throws `TypeError` for logged-in users. `WishList.jsx` has the identical pattern. | Key operations by `product_id`, never by array index. | TODO |
| **CF-22** ✅ **DONE (Phase 5, Slice 3)** — was re-rated HIGH → **GO-LIVE BLOCKER** on discovery; see [CONSTRAINT 5](#2-hard-ordering-constraints).<br><br>**Root gap:** the client backend had **no full-catalogue endpoint**, which is why the shop borrowed the admin's. Added `GET /api/products` — public, customer-safe fields only. Also rewrote `GET /api/products/new-releases`, which was `SELECT *` (leaking `is_deleted`/`created_at`/`updated_at` — this closes **`CB-35`**) and returned **no images at all**, so the homepage could not have used it without rendering seven blank thumbnails.<br><br>**`stock_qty` → `in_stock` boolean** on all three public product endpoints (`/products`, `/products/:category`, `/bestsellers`). The exact count is inventory data; whether an item is buyable is not. Verified the storefront reads stock **nowhere** (zero occurrences), so nothing broke, and `CF-20` now has the boolean it needs to disable Add-to-Cart at zero.<br><br>**Re-pointed:** `App.jsx` → `CLIENT_API/api/products`; `Homepage.jsx` → `CLIENT_API/api/products/new-releases` (it had been downloading all 35 products to filter 7 in the browser). `ADMIN_API` is no longer imported anywhere in the storefront.<br><br>⚠️ **Caught during the switch:** `Homepage.jsx`'s image mapper tested only `rawImgObj?.image_url`. The client backend returns `{id, url, is_primary}`, so the ternary fell through and assigned the **object itself** to `image1` — every new-release thumbnail would have rendered broken. Fixed to accept both shapes. `App.jsx` and `ViewProductPage` already did.<br><br>**Verified with the admin backend fully STOPPED and no session:** `/products` 35, `/products/new-releases` 7, `/collections` 6, `/bestsellers` 3; all 35 normalise to a usable id + name + image string; filter facets still populate (8 categories, 6 collections); the built storefront bundle contains **zero** admin-backend URLs. Admin panel regression-tested unaffected, and its routes still 401 anonymously.<br><br>**Deploy note:** `admin-backend`'s `CORS_ORIGINS` may now drop `https://paisilks.com` — no storefront call reaches it. | `App.jsx:48`; `Homepage.jsx:136-137` | ~~RE-RATED GO-LIVE BLOCKER~~ This was filed as a privacy/coupling issue. Phase 2's `authMiddleware` on every admin route turned it into a **hard breakage**: an anonymous customer now gets 401 from `get-all-product-details`, so `/shop` and the homepage's New Collection render **empty**. Masked twice — locally by port-agnostic cookies lending the shop the owner's admin session, and in production by `AB-01` (the deployed admin backend has **no auth at all**; verified 200 + 35 products with no cookie). **Must ship with, or before, the Phase 2 deploy.** | `App.jsx:48`; `Homepage.jsx:136-137` | **The customer storefront fetches its entire product catalogue from the ADMIN backend** (`pai-silks-website.onrender.com/api/get-all-product-details`, which lives in `admin-backend/src/routes/adminRoutes.js:28`), while the client backend's own `/api/products/new-releases` goes **unused**. This exposes `stock_qty` and internal timestamps to every anonymous visitor and couples shop availability to the admin service. | Move the storefront onto client-backend endpoints. Never let the public site depend on the admin service. | TODO |

#### MEDIUM

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **CF-13** ✅ **DONE (Phase 5, Slice 6)** — two stacked defects. **(a)** `addToCart` hardcodes `quantity 1` and deliberately ignores the client's value (making it increment is what caused the `CF-02`/`CB-22` over-billing), so the guest's quantity never reached the database — the UI showed 3 while the DB held 1, and the customer was **shown 3× the price and charged 1×**. The merge now POSTs to **`/api/cart/update`**, the documented path for quantity changes, rather than loosening `addToCart`. Verified: `cart/add` → qty 1, `cart/update qty=3` → qty 3, and checkout then bills 3 × ₹3,999. `Promise.allSettled` so one failed row cannot abort the rest of the merge or skip the wishlist fetch. **(b)** the `NaN` path is closed at its source — `App.jsx`'s normalised product now sets `quantity: 1`. Items added via `ProductCard` carried **no quantity key at all**, so `Number(undefined)` → NaN → `Math.max(NaN, 1)` → NaN entered state and serialised to `null` in localStorage. Verified. | `LoginPage.jsx:107-126` | **Guest→login merge invents a quantity that is never persisted.** `finalQty = Math.max(localQty, serverQty)` is set in state but **no `POST /api/cart/update` is ever issued** — and since `cart/add` hardcodes `quantity = 1`, the DB says 1 while the UI says 3 → **the customer is shown 3× the price and charged 1×**. Also `localItem.quantity` is `undefined` for every item added via `ProductCard`/`App.jsx:212` (the normalised object at `App.jsx:81-94` has no `quantity` key) → `Number(undefined)` → `NaN` → `Math.max(NaN, 1)` → **`quantity: NaN`** enters state and serialises to `null` in localStorage. Downstream `|| 1` fallbacks mask it by luck. | Persist the merged quantity with `cart/update`. Always initialise `quantity: 1` on the normalised object. | TODO |
| **CF-14**  ✅ **DONE (Phase 5.5, Slice 5)** — the homepage "Buy Now" handler is `async` and **awaits** `handleAddToCart` before navigating. Since the server builds the order from the DATABASE cart, a fast click previously reached checkout before the item was recorded, producing `"Cart is empty"` for a saree plainly on screen — or billing stale items from an earlier session. | `Homepage.jsx:489-490` | **"Buy Now" navigates without awaiting the cart sync.** `handleAddToCart` is `async` and is not awaited before `navigate("/checkout")`. Since the server builds the order from the **DB** cart, a fast user gets `400 "Cart is empty"` for an item plainly on screen — or, worse, is billed for **stale items from a previous session**. | `await` it, and show a pending state. | TODO |
| **CF-15** ✅ **DONE (Phase 5.5, Slice 2)** — fixed at the **query**, not the component. `getWishlist` used `SELECT p.*`, which returned `selling_price` while `WishListProductItem.jsx` renders `item.discounted_price` — so every saved item showed **`₹ undefined`** for the whole session after login. Verified live before the fix. The query now names its columns and aliases `p.selling_price AS discounted_price`, keeping `selling_price` alongside for other call sites. **Also closed a leak nobody had recorded:** `p.*` was returning `is_deleted`, `is_new_release`, `created_at` and `updated_at` — the same internal-column exposure fixed in `getNewReleaseProducts` (`CB-35`, Slice 3); this sibling had been missed. **Verified:** `discounted_price` now `'3999.00'`, internal fields **NONE**. | `LoginPage.jsx:136-138` | **Wishlist prices render as `₹ undefined` for the whole session after login.** This path sets state from raw API data, bypassing the normalisation `CartContext.jsx:37-44` performs. `sqlQueries.js:148-158` returns `p.*` — i.e. `selling_price`/`regular_price`, and **no `discounted_price`** — while `WishListProductItem.jsx:38` renders `₹ {item.discounted_price}`. | Route through the same normaliser, or normalise here. | TODO |
| **CF-16** ✅ **DONE (Phase 5, Slice 6)** — `firstItem` was deliberately set to `null` for an order with no items and then dereferenced on the **very next line**, so `firstItem.image` threw during render and blanked the entire `/my-orders` page, hiding every other order the customer had. Now optional-chained throughout. Also removed the `[order]` fallback from `itemsArray`, which wrapped the ORDER in an array and treated it as an item so `extraCount` counted orders as products (that is `CF-38`, closed here too). **Verified** by rendering the card logic against orders with 0, 1 and 3 items — the empty case returns a placeholder image and "Unknown Product" instead of throwing. | `MyOrders.jsx:17-34` | **`OrderCard` dereferences a null `firstItem`.** The ternary at `:17` correctly yields `null` when `order.items === []`, then `:20` does `firstItem.image` unconditionally. **Reachable, not theoretical:** `createOrder` inserts the order row (`customerController.js:614`) *before* looping the items (`:625-628`), so any failure in that loop leaves an order with zero items — and `:696-699` unconditionally assigns `order.items`. Result: `TypeError` inside render → **the entire `/my-orders` page goes blank, hiding all the user's other orders.** | Guard every `firstItem` access with optional chaining and a fallback. Fixed at the source by `CB-06` (transaction). | TODO |
| **CF-17**  ✅ **PARTIAL (Phase 5.5, Slice 5)** — rollback added to the two handlers that can misbill: cart quantity change and wishlist removal both capture the previous state, check `res.ok`, restore on failure and surface a toast. This matters more here than in a normal app because **checkout bills from the database cart while the screen shows React state**, so a silently dropped update means the customer is shown one quantity and charged another. The remaining optimistic sites in `CartContext` are lower-consequence and are left for Phase 6. | `CartContext.jsx:97-99, 124-127, 151-154, 171-174`; `Cart.jsx:58-60`; `WishList.jsx:51-54, 107-109`; `LoginPage.jsx:140-142` | **Optimistic updates with no rollback at 8 sites** — every one is `catch (error) { console.error(...) }`, with state mutated *before* the request. This matters far more here than in a normal app because **the server bills from the DB cart while the UI bills from React state**: a single dropped request permanently desynchronises what the customer sees from what they are charged, with no visible error and no retry. `LoginPage.jsx:140-142` is the worst — one `console.warn` swallows the entire guest-cart sync, the final cart fetch **and** the wishlist fetch, then `:145-149` navigates straight to `/checkout` with the unsynced cart on screen. | Save prior state, restore on failure, surface a toast. Consider refetching from the server as the single source of truth after every mutation. | TODO |
| **CF-18**  ✅ **DONE (Phase 5.5, Slice 5)** — the newsletter form has an `onSubmit` with `preventDefault`, a controlled input with a `name`, and honest feedback. Without a handler the browser performed a native GET to the current URL: a full page reload that closed the cart drawer, lost the scroll position and appended `?` to the address bar — while subscribing nobody, since the input had no `name` either. The footer renders on nearly every page, so this was a reload trap under the whole site. It deliberately does **not** claim the address was subscribed — there is no mailing-list backend, and saying "you're subscribed!" when nothing was recorded is the same dishonesty as `CF-21`. | `Footer.jsx:43-80` | **Newsletter `<form>` has no `onSubmit` and no `action`.** Submitting performs a native GET to the current URL: **full page reload**, cart drawer and scroll position destroyed, `?` appended to the address bar (and with no `name` on the input, nothing useful is even sent). The Footer renders on `/`, `/shop`, `/about-us`, `/my-orders`, `/my-profile`, `/product/:id` — so "Subscribe" is a page-reload trap on nearly every page. Nothing is ever subscribed. | Add `onSubmit` with `preventDefault` and a real endpoint, or remove the form. | TODO |
| **CF-19** ✅ **DONE (Phase 5, Slice 6)** — `productId` is now validated as a positive integer **before** it reaches the URL. The route is `/product/:productId` and the fetch was `/api/${productId}`, so `/product/collections` requested `/api/collections` — a **real endpoint returning `success: true`** — and the page rendered a "product" built from the collections payload with every field undefined. The server cannot help here: it correctly 400s `/api/abc`, but `/api/collections` is a legitimate route. **Verified:** `collections`, `abc`, `..%2Fx`, `0`, `-1` and `1.5` now all short-circuit to "Product not found" with no request at all, while `/product/49` still fetches normally. Second half also fixed — `product` is reset to `null` when a fetch fails or returns `success: false`, so navigating from product A to a deleted product B no longer leaves A's name, description and **price** on screen under B's URL with a working Add to Cart button. | `ViewProductPage.jsx:68, :105, :71-93` | **Unencoded, unvalidated URL parameter interpolated into an API path.** `productId` from `useParams()` is interpolated with no `encodeURIComponent` and no numeric validation. Visiting `/product/collections` makes the app fetch `/api/collections`, whose response **also** has `success: true`, so `:71` passes and `setProduct` populates from the collections payload — rendering a product page of `undefined` fields. `/product/..%2Fsomething` escapes the intended path segment. Same at `:105` with `product.category`. **And when `res.success` is false, `product` is never reset** — navigating from product A to a deleted product B leaves A's name, description and **price** on screen under B's URL, with a working "Add to Cart" button. | Validate as an integer before fetching; `encodeURIComponent` the category; reset `product` to `null` on failure. | TODO |
| **CF-20**  ✅ **DONE (Phase 5.5, Slice 5)** — the storefront now knows about stock. `App.jsx` carries `in_stock` through its normaliser (it previously discarded the field), and `ProductCard` disables Add to Cart with a `disabled:opacity-40` style and shows *"Sorry, this saree is out of stock"* instead of accepting it. Uses the **boolean** added in Slice 3, not a raw count — the exact figure is inventory data customers should not see. Defaults to `true` so a product from an endpoint that omits the field is not wrongly hidden. **Verified:** setting product 52 to `stock_qty = 0` flipped `in_stock` to `false` in the API response. Previously an unavailable saree entered the cart, showed a total, and failed only after the customer had typed their entire address. | `App.jsx:81-94`; `Checkout.jsx:164` | **No client-side stock check at all.** The admin payload includes `stock_qty` and `App.jsx:81-94` **discards it**. Out-of-stock items add to the cart and show a total; the failure only surfaces as `alert("Failed to place order: Insufficient stock for product_id 12")` **after the user has filled in the entire address form.** | Carry `stock_qty` through; disable Add to Cart at 0; validate before checkout. | TODO |
| **CF-21** ⏸️ **HELD — superseded by the Product Reviews feature (see Deferred work)** — do NOT close this by deleting `reviews.js`. Owner decided 2026-08-29 to build real verified-purchase reviews instead, after Phase 6, and the dummy data becomes the zero-state fallback. Skipped in Phase 5.5 Slice 5. | `reviews.js` → `Homepage.jsx:11, :529-534` | **Fabricated customer reviews rendered as genuine testimonials.** Five invented customers with names and star ratings, under the heading **"Our Happy Customers"**, with no reviews API and no disclaimer. In India this is a consumer-protection exposure under the CCPA/BIS fake-review framework, independent of the code question. | Remove the section, or clearly label it as illustrative, or build a real reviews feature. | TODO |
| **CF-23**  ✅ **DONE (Phase 5.5, Slice 5)** — the apartment/flat number is included in `shipping_address`. Confirmed against a real order first: the owner typed "Hiranandani flat" and the stored address read `B. Road Hassan, Hassan, Karnataka - 573201`. Built with `.filter(Boolean).join(", ")` so an absent, empty or whitespace-only apartment does not leave a stray `, ,` in the address — all four cases verified. **After:** `B. Road Hassan, Hiranandani flat, Hassan, Karnataka - 573201`. | `Checkout.jsx:129, :274-283` | **The `apartment` field is collected and then silently discarded.** `shipping_address` is built from `address, city, state - pincode` only. **Flat/apartment numbers never reach the courier** → misdeliveries. | Include `apartment` in the composed address. | TODO |
| **CF-24**  ✅ **DONE (Phase 5.5, Slice 5)** — `AbortController` on **both** effects in `ViewProductPage` (the product fetch and the similar-products fetch), plus the previously-uncleaned `setTimeout` now tracked and cleared. Navigating quickly between products left two requests in flight and whichever answered last won, so the page could settle on the product already navigated away from. An `AbortError` is treated as expected rather than clearing the product the newer request is loading. The category is now `encodeURIComponent`-ed too — it goes into a URL path and can contain spaces ("Pure Mysore Crape Silk Sarees"). | `ViewProductPage.jsx:97, :64-99, :101-134` | `setTimeout(() => setLoading(false), 500)` inside `.finally()` with **no cleanup**, and **no `AbortController`** on either effect. Rapid navigation leaves timers and in-flight responses resolving into an unmounted tree; two overlapping fetches can land out of order and **render the wrong product**. | Add `AbortController` + `clearTimeout` in cleanup. | TODO |
| **CF-25**  ✅ **DONE (Phase 5.5, Slice 5)** — thumbnails are now "every bestseller except the one on display, capped at three", replacing `[1,2,3].map(off => (current + off) % length)` which always produced exactly three regardless of how many products existed. Verified: 1 product → `[0,0,0]` duplicate React keys; 2 → `[1,0,1]` duplicate keys; **3 → `[1,2,0]`, where index 0 IS the current product, shown as one of its own "other products"** — and there are exactly 3 bestsellers today, so that case was live. After: 1 → `[]`, 2 → `[1]`, 3 → `[1,2]`, 4+ → `[1,2,3]`, never repeated, never itself. | `Homepage.jsx:55-61, :404` | `thumbnails` takes offsets `1,2,3` modulo `bestSellers.length`. With fewer than 4 bestsellers this produces **duplicate React `key` values** and shows the currently-displayed product as its own "other product" thumbnail. With exactly 1 bestseller, all three thumbnails are the main product. | Guard on length; de-duplicate. | TODO |

#### LOW

| ID | Location | Problem | Fix | Status |
|---|---|---|---|---|
| **CF-26** | `Homepage.jsx:111, :119` | `.then(res => res.json())` with **no `.catch()`** on the collections and bestsellers fetches → unhandled rejections on any non-JSON response. Render cold-start HTML error pages are exactly this. | Add `.catch` and default to `[]`. | TODO |
| **CF-27** | `Homepage.jsx:87-96, :256`; `PeacockLoader.jsx:26` | `document.body.style.overflow = "hidden"` gates scroll on two loading flags. It recovers (both are cleared in `finally`), but the page is **scroll-locked for the duration of two cold-start Render requests**, and `PeacockLoader` — a `fixed inset-0` fullscreen component — is rendered **inside a 6-column CSS grid cell**. | Remove the scroll lock; render the loader outside the grid. | TODO |
| **CF-28**  ✅ **DONE (Phase 5.5, Slice 5)** — `Checkout`'s auth guard now runs **before** `setIsSubmitting(true)`. It used to set the flag and then return early, skipping the `try` whose `finally` would have cleared it, so an interrupted submit left the button stuck in its spinner permanently. | `Checkout.jsx:114-121, :169-171` | `setIsSubmitting(true)` runs **before** the `!userId` early return, which exits before the `try` whose `finally` would reset it. The spinner sticks if navigation is interrupted. | Move the guard above the state change. | TODO |
| **CF-29** | `Checkout.jsx:40, :360` | **No empty-cart guard.** `/checkout` renders with an empty summary, a `₹ 99` total, and a live "Pay Now" button that produces `400 "Cart is empty"`. | Redirect to `/shop` when the cart is empty. | TODO |
| **CF-30** | `Checkout.jsx:207-210, :36, :59` | The "Keep me updated with offers" `<Checkbox />` has **no `name`, no `control`, no `onCheckedChange`** — permanently unwired. `rememberMe` is declared in the schema and defaults and never rendered or used. | Wire or remove both. | TODO |
| **CF-31** | `App.jsx:131`; `FilterandSort.jsx:161-173` | `[...new Set(products.map(p => p.category))]` includes `undefined` for any product without a category → a filter checkbox with `key={undefined}` and an empty label. | Filter out falsy values. | TODO |
| **CF-32** | `App.jsx:118` | Collection filtering falls back to `pDesc.includes(target)`, so a product whose **description** mentions "party wear" is shown under the Party Wear collection. Silent mis-categorisation. | Match on the collection field only. | TODO |
| **CF-33** | `App.jsx:51` | `const data = res.data || (res.success ? res.data : [])` — the ternary is **unreachable**: if `res.data` is falsy, both branches evaluate to `undefined`. Dead, confusing expression. | Simplify to `res.data ?? []`. | TODO |
| **CF-34** | `Header.jsx:14, :97-98, :105-106`; `Cart.jsx:11-19`; `WishList.jsx:9-14` | **~24 lines of dead prop plumbing across 6 files.** `Header` accepts `cartItems`/`onUpdate`/`wishListItems`/`onWishListUpdate` from all six pages and forwards them to `Cart` and `WishList` — and **both children ignore them entirely** and read `useContext(CartContext)` directly. `WishList.jsx:13` destructures `cartItems` and never uses it. | Delete the props from all six call sites. | TODO |
| **CF-35** | `Homepage.jsx:520-522`; `Categorycard.jsx` | `CategoryCard` is rendered in an infinite marquee with **no `onClick`** — six category tiles that look interactive and do nothing. | Wire them to `/shop?category=…` or make them visually non-interactive. | TODO |
| **CF-36** | `Homepage.jsx:449-461` | The bestseller "Add to Cart" branch is the **only** add-to-cart path that does not call `showToast` (compare `:218-219`, `ProductCard.jsx:24`). It also spreads `{...currentProduct}` raw, so the cart entry carries `selling_price` rather than the `discounted_price` every other path uses — surviving only because of the fallback chains. | Normalise and add the toast. | TODO |
| **CF-37** | `MyOrders.jsx:100-103` | **"View Details" has no `onClick`.** `GET /api/order/:order_id` exists and is never called. A dead primary action on every order card. | Wire it or remove it. | TODO |
| **CF-38** | `MyOrders.jsx:16` | `order.items || order.order_items || [order]` — the `[order]` fallback wraps the **order** in an array and treats it as an item, so `extraCount` (`:36`) counts orders as products. Defensive coding that produces wrong output instead of an error. | Default to `[]`. | TODO |
| **CF-39** | `MyOrders.jsx:165-183, :171` | `Math.abs(today - orderDate)` makes a **future-dated order look recent**, and `rawDate` falls back to `new Date()` so an order with a null date is silently classified as "today". | Remove `Math.abs`; render "—" for a missing date. | TODO |
| **CF-40** | `MyProfile.jsx:11-16, :40, :253-300` | Imports `Popover`, `PopoverContent`, `PopoverTrigger`, `Calendar` and holds `isCalendarOpen` state for a DOB field that is **entirely commented out** — dragging `react-day-picker` + `date-fns` into the production bundle for zero rendered UI. | Delete the imports, the state, and the commented block. | TODO |
| **CF-41** | `ToastContext.jsx:18-20, :90-95` | `setTimeout(() => removeToast(id), 3000)` with **no cleanup and no clear on manual dismiss.** Closing a toast leaves its timer to fire a no-op `setState` 3 s later; unmounting the provider leaks every pending timer. | Track and clear timer IDs. | TODO |
| **CF-42** | `Cart.jsx:22-28`; `CartItem.jsx:6-11, :13-17, :20, :64` | **Three-level state duplication for one cart** (`cartItems` context → `dynamicCartItem` → `itemCount`), synced by two mirroring effects. Increment has **no upper bound and no stock ceiling**, and `POST /api/cart/update` writes it verbatim. Decrement **is** guarded (`<= 1` plus a disabled button), so **quantity cannot go zero or negative through the UI** — see [false positives](#12-confirmed-false-positives). | Read from context directly; add a max and a stock check. | TODO |
| **CF-43** | `MyOrders.jsx:256, :276` | `key={order.id || order.order_id || Math.random()}` — `order.id` never exists (`sqlQueries.js:253` selects `order_id`), so this relies on `order_id` always being present; when it isn't, a fresh key every render forces a full unmount/remount. | Use `order.order_id`; drop the `Math.random()`. | TODO |
| **CF-44** | `CartContext.jsx:133-155`; `WishList.jsx:26-55` | **Two divergent wishlist-removal implementations** — the context one keyed by `productId`, the `WishList` one keyed by array **index** with its own duplicate `dynamicWishListItem` copy. The drawer uses its own and ignores the context version; `Homepage.jsx:176` and `ViewProductPage.jsx:161` use the context one. Two sources of truth with different bug profiles (see `CF-12`). | Keep the context implementation; delete the component-local one. | TODO |
| **CF-45** ✅ **DONE (Slice 6)** — per-field validation with inline messages: name ≤50, email format + ≤100, phone via the country selector, password 8..72 bytes, address ≤500. Errors clear as the user edits | `Signup.jsx:24-30, :122-251` | **Weak signup validation.** Present: `required` on all five fields, `type="email"`, `minLength={6}`. Missing: any `pattern`/length constraint on `phone_number` (`type="tel"` accepts `"abc"`), any `maxLength` on `user_name`/`address`, password confirmation, password strength, email normalisation (trim/lowercase — `LoginPage.jsx:59` then stores the raw casing), `autoComplete` attributes on either auth form, and any client-side throttle. | Add all of the above; mirror server-side (`CB-28`). | TODO |
| **CF-46** | `LoginPage.jsx:57-59` | `user_id`, `user_name`, `user_email` in localStorage. The email is not sensitive on its own — the issue is that it sits next to the `user_id` that **is** the credential. | Removed by Phase 2.3 step 3. | TODO |
| **CF-47** | `index.html:1-14, :5, :6` | No `<meta name="description">`, no Open Graph tags, no `theme-color`, no CSP — on a commercial storefront. Declares `type="image/svg+xml"` for a **`.png`** favicon. Google Fonts loaded blocking with no `preconnect`. | Add the meta tags and CSP; fix the favicon type; `preconnect` + `display=swap`. | TODO |
| **CF-48** | `vite.config.js:14-18` | `server.allowedHosts: ['fleshly-succulently-jona.ngrok-free.dev']` — **a developer's personal ngrok tunnel committed into the repo.** Dev-server only, but it is a leaked internal endpoint. Combined with `vite@7.0.6` (which predates the 7.0.7+ dev-server file-serving patches), a developer running `npm run dev` behind that tunnel exposes a patchable dev server to the internet. | Delete the entry; move to a local `.env`. Bump Vite to the latest 7.x. | TODO |
| **CF-49** | `.gitignore:1-24` | **No `.env` entry.** `*.local` catches `.env.local` by luck of the glob, but `.env`, `.env.production` and `.env.development` are unignored. Given a sibling backend already leaked one, the first developer to add Vite env vars here will commit them. | `SEC-01` step 3. | **DONE** — ignores `.env` / `.env.*`, keeps `.env.production` + `.env.example` tracked (verified with `git check-ignore`). |
| **CF-50** | dead code | **19 of 20 CSS files are dead** — only `index.css` is imported (`main.jsx:6`). `App.css`, `Checkout.css`, `Homepage.css`, `MyOrders.css`, `MyProfile.css` and all 14 `components/*.css` are referenced by no `import`. A full pre-Tailwind stylesheet layer left in place, guaranteeing the next person to edit `components/Cart.css` will wonder why nothing changes. Also dead: `components/Pageloader.jsx` (superseded by `PeacockLoader`, and the **sole** reason `lottie-react` + `assets/lottie/animation.json` are installed), `components/ui/card.jsx` (101 lines), `components/ui/textarea.jsx`, `src/userOrder.js` (fabricated data, no real PII), and `src/products.js` (**328 lines of mock products with fake prices**, imported at `Homepage.jsx:9` solely to feed `topFourProducts` at `:42`, which is never rendered — tree-shaken, but one careless line away from being displayed as real). | Delete all of it. | TODO |
| **CF-51** | `package.json` | **8 unused dependencies** (verified zero imports): `@tanstack/react-table`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-progress`, `@radix-ui/react-icons`, `@tailwindcss/vite` (installed but **not** wired in `vite.config.js` — two competing Tailwind pipelines declared, one used), `date-fns`, `lottie-react` (only `Pageloader.jsx`, which is dead), `react-day-picker` (only via the commented-out DOB field — see `CF-40`). Also `zod@4`: `Checkout.jsx:27` uses `z.string().email()`, soft-deprecated in v4 in favour of `z.email()`. | Remove all 8; run `npm audit`; migrate the Zod call. | TODO |
| **CF-52** | `eslint.config.js:8, :11-15` | **`npm run lint` fails with 22 errors, and the config itself is broken.** It omits `eslint-plugin-react`, so JSX identifier usage isn't tracked — producing **false** `no-unused-vars` errors (e.g. `ProfileSection.jsx:51` reports `'Icon' is defined but never used` when it *is* used at `:69`). The output cannot be trusted as-is, which is presumably why 22 errors accumulated. It also fails to ignore config files, hence two `no-undef` errors. **Genuine** dead code it catches: `Homepage.jsx:42` (`topFourProducts`), `Homepage.jsx:48, 66` and `ViewProductPage.jsx:54, 60` (leftover heart-toggle state), `Header.jsx:3-5` (three unused SVG imports), `AboutUs.jsx:15`, `MyProfile.jsx:40`, `WishList.jsx:13`, and `useLocation` imported-unused in three files. | Add `eslint-plugin-react` with `jsx-uses-vars`, ignore config files, then fix the real ~15 and gate CI on lint. | TODO |
| **CF-55** 🆕 ✅ **DONE (Phase 5.5, Slice 5)** — found by the owner, 2026-08-29.<br><br>**14 places** decided identity by reading `localStorage.getItem("user_id")`; now **zero** do. A new `AuthContext` calls `/api/verify-token` once and is consumed by `ProfileSection`, `PrivateRoute`, `CartContext` (×5), `Checkout` (×2), `Cart` (×2), `WishList` (×2), `MyOrders` and `MyProfile`. `LoginPage` calls `refresh()` so the header updates without a page reload, and `AuthProvider` wraps `CartProvider` because the cart must know the auth state before choosing server or guest mode. Effects that previously used `[]` now depend on the auth state — they ran once, before `verify-token` had answered, and gave up permanently.<br><br>**Verified:** anonymous → 401 → header shows "Profile"; signed in → 200 → greeted by name; after logout → 401 → header reverts immediately. `PrivateRoute` also stopped re-requesting on every navigation.<br><br>**One bug, three reported symptoms:** a header greeting a signed-out customer while every protected page refused them; a cart that emptied on refresh (`CartContext` saw a stale key, silently ran in guest mode, and items never reached the database); and My Orders bouncing to login. | `components/ProfileSection.jsx:20-23, :110, :129, :139`; `Checkout.jsx:172`; vs `components/PrivateRoute.jsx` | **The header says you are logged in while the server says you are not — two sources of truth that drift apart.**<br><br>**Observed:** the site greeted the owner by name and showed a Logout button, but clicking **My Orders** bounced straight to `/login`. Nothing was stuck — the UI was reporting a state that no longer existed. Database session was genuinely `ACTIVE`, 36 minutes old against a 7-day window, and `authMiddleware`'s `maxAgeSeconds` maths checked out; the browser's httpOnly cookie was simply gone while `localStorage` survived.<br><br>**Cause:** `ProfileSection` decides `isLoggedIn` from `localStorage.getItem("user_id")` — a plain string the visitor can edit — while `PrivateRoute` (correctly, since Phase 2) asks the SERVER via `/api/verify-token`. `Checkout.jsx:172` holds a **third** copy of the question, also reading localStorage, and alerts *"Please login first"* on submit.<br><br>This is `CF-05`/`CF-46` surfacing in practice. Phase 2 closed the **security** half — every protected route and API call now verifies server-side, so this is not an auth bypass. What was never converted is the **UI's** notion of identity, so the storefront can confidently show a logged-out customer their own name and then refuse them their orders.<br><br>**Fix:** one auth source. An `AuthContext` that calls `/api/verify-token` once and is consumed by `ProfileSection`, `PrivateRoute` and `Checkout` alike; `localStorage` keeps display niceties only, never identity. That also removes `Checkout`'s duplicate guard and `CartContext`'s `localStorage.getItem("user_id")` check, which silently drops the cart into guest mode when the key goes stale — the same root cause behind the owner's "cart empties on refresh" report. | Single server-derived auth state; localStorage never decides identity. | TODO |
| **CF-54** 🆕 ✅ **DONE — found by the owner testing in a browser, 2026-08-29** | `Checkout.jsx` order payload | **🔴 CHECKOUT WAS BROKEN FOR EVERY REAL CUSTOMER FROM PHASE 3 UNTIL NOW.** Placing an order from the actual form returned `Failed to place order: Invalid value for "items".`<br><br>**Cause:** Phase 3 (`953d7be`) mounted `rejectNonScalarBody` router-wide — correctly, since non-scalar values corrupt mysql2 placeholders (`AB-11` / `CB-29`). `Checkout.jsx` sends `items: cartItems.map(...)`, an **array**, so every checkout was refused at the middleware before reaching the handler.<br><br>**Why the server never needed it:** `createOrder` destructures exactly `{ shipping_address, payment_method, phone_number }` and builds the order lines from the **database cart** — that is the deliberate `CF-01`/`CB-03` defence against a client naming its own prices. `items` was dead payload that the false-positives section had already flagged as *"a loaded gun aimed at whoever next refactors the server"*. It turned out to be worse than dead: it was actively breaking checkout.<br><br>**Fixed** by sending only the three fields the server reads. `customer_name` and `email` dropped too — also unread, and both already on the account row reached through the session.<br><br>⚠️ **Why five phases of testing missed it — worth remembering.** Every curl test against `/api/orders/create` sent a hand-written body containing only the fields the handler reads. The real form sends more. **A test that constructs its own payload cannot catch a payload bug.** Verified after the fix with the browser's exact body: order created, `subtotal 11997` for 3 × ₹3,999, quantity honoured. A sweep of every `JSON.stringify` request body across both frontends found **no other non-scalar field**, so checkout was the only instance. | Send only what the server reads. | **DONE** |
| **CF-53** | `tailwind.confing.js`; `README.md` | `tailwind.confing.js` — filename typo, `module.exports` in a `"type":"module"` package, loaded by nothing; its custom colours are never applied (the real theme is `src/index.css:16+` `@theme inline`). `README.md` is the **unmodified Vite template** — no setup instructions, no env documentation, no deployment notes, no mention of the two backend domains. | Delete the config; write a real README. | TODO |

#### Crash-on-undefined (client frontend)

"App-wide" = blank page, because there is **no ErrorBoundary anywhere**. `CF-10` fixes the blast radius of all seven.

| ID | Location | Trigger | Blast radius |
|---|---|---|---|
| **CF-C-F1** | `CartContext.jsx:60-61` | `JSON.parse` throws on malformed `cart`/`wishlist` | **App-wide and PERSISTENT.** Every route blank until the user manually clears site data. |
| **CF-C-F2** | `MyOrders.jsx:20-34` | `firstItem` is `null` when `order.items === []` (reachable — see `CF-16`) | Entire `/my-orders` page blank; all other orders hidden. |
| **CF-C-F3** | `Cart.jsx:53` | `itemToUpdate` undefined (stale index) | Cart drawer + page blank. Also injects a phantom row at `:39` first. |
| **CF-C-F4** | `WishList.jsx:47` | `itemToRemove` undefined (stale index) | Wishlist drawer + page blank. |
| **CF-C-F5** | `Homepage.jsx:56, :58` | `bestSellers` set to `undefined` at `:119` → `.length` on undefined | Homepage blank. |
| **CF-C-F6** | `Homepage.jsx:258` | `collections.map` — `setCollections(data.data)` with `data.data` undefined | Homepage blank. |
| **CF-C-F7** | `Homepage.jsx:81` | `wishListItems.some` on undefined (set from a missing `data` at `LoginPage.jsx:138`) | Homepage blank. |
| **CF-C-F8** | `ViewProductPage.jsx:141, :149` | `wishListItems.some` / `cartItems.some` on undefined | Product page blank. |
| CF-C-F9 | `ViewProductPage.jsx:17` | `extractImages(res.data)` when `res.data` is `null` but `success` true | **Contained** — `.catch` at `:95` → "Product not found". |
| CF-C-F10 | `CartContext.jsx:23, :37` | `cartData.data.map` when `success: true` without `data` | **Contained** — try/catch at `:49`. |
| CF-C-F11 | `LoginPage.jsx:104` | `finalCartData.data.map` | **Contained** — `catch (syncErr)` at `:140`. |
| CF-C-F12 | `Homepage.jsx:141` | `result.data.filter` | **Contained** — try/catch at `:163`. |
| CF-C-F13 | `ReviewCard.jsx:30, 45, 49, 54` | `review.*` with no null guard | **Safe today** (static 5-element array); **becomes a crash the moment reviews come from an API.** |

> **XSS: clean.** Verified zero `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function`, `document.write` across all of `src/`. API strings (`product.description`, `product.name`, `user.name`) are rendered as JSX text children and correctly auto-escaped. API values do reach `<img src>` (`ProductCard.jsx:62`, `MyOrders.jsx:62`, `CheckOutItem.jsx:46`, `CartItem.jsx:32`, `Homepage.jsx:387, 409`) — not a script sink. **No `href` anywhere is API-derived** (all are static literals in `Footer.jsx`). **No secrets in the bundle:** zero `VITE_*`, zero `import.meta.env`, zero `process.env` — no Razorpay key, no Cloudinary key, no JWT secret. Keep it that way.

---

### Database schema — `DB-*`

See [Phase 4.1](#41-schema-migrations) for the full table. Summary of what the schema does **not** enforce:

- **One foreign key in the entire database** (`session_ibfk_1` on `session.user_id`). `cart`, `wishlist`, `orders`, `order_items`, `product_images`, `product_stock` have **none**.
- **No unique constraint on `cart(user_id, product_id)`** — the schema half of `CF-02`/`CB-22`. (`wishlist` correctly has `UNIQUE KEY (user_id, product_id)`.)
- **No unique constraint on `product_stock(product_id)`** — enables `CB-32`.
- `orders.status` is nullable and **already NULL in production** for rows 12 and 13 (`CB-23`/`CF-07`).
- `product.category` is denormalised free text, disconnected from the `category` table (`AB-31`).
- `master_user` rows 1, 2, 3 share an **identical bcrypt hash** — a seeded/shared password (`DB-08`).

---

### Dependencies & tooling — `DEP-*`

| ID | Applies to | Problem | Fix | Status |
|---|---|---|---|---|
| **DEP-01** | both backends | **They are Create-React-App projects.** `react`, `react-dom`, `react-scripts@5.0.1`, `@testing-library/*`, `web-vitals`, plus `"name": "project1"`, a CRA `browserslist`, an `eslintConfig: react-app`, and a `public/` folder with `index.html`/`favicon.ico`/`manifest.json`/`robots.txt`. **~800 of 913 `node_modules` entries are frontend tooling in a production server**, and `react-scripts@5.0.1` drags in a large historically CVE-heavy webpack/babel/jest tree. | Strip every frontend dep, the `public/` folder, `browserslist`, `eslintConfig`, and the `build`/`test`/`eject` scripts. Rename the package. | TODO |
| **DEP-02** | both backends | **Both `bcrypt@6` AND `bcryptjs@3` installed.** Only `bcrypt` is imported (`bcryptjs` has zero grep hits). Two hashing libraries invites the classic hash-with-one/verify-with-the-other bug, and `bcrypt` is a native addon needing a compiler (a Docker/CI footgun). | Remove `bcryptjs`. Decide deliberately whether to keep native `bcrypt`. | TODO |
| **DEP-03** | both backends | **The squatted `crypto@1.0.1` npm package is installed** (`npm/deprecate-holder`, empty `main`). Verified inert at runtime — Node's core module wins resolution — but it is a live supply-chain liability and it pollutes the lockfile. | `npm uninstall crypto`. | TODO |
| **DEP-04** | both backends | **`jsonwebtoken@9` is installed and never imported** (zero grep hits) while both backends hand-roll a broken token (`AB-24`, `CB-24`). The auth layer was started and abandoned. | Use it in Phase 2.1. | TODO |
| **DEP-05** | both backends | `nodemon` is in `dependencies`, not `devDependencies` — a file-watcher shipped to production. | Move it. | TODO |
| **DEP-06** | both backends | **Missing security deps:** `helmet`, `express-rate-limit`, `express-validator`/`zod`/`joi`. All verified absent from both `package.json` **and** `node_modules`. This is why there is no validation on any of the 38 routes. | Install in Phases 1 and 3. | TODO |
| **DEP-07** | both backends | Broken script: `"backend": "nodemon backend/server.js"` — that path does not exist (the file is `src/server.js`). `build`/`test`/`eject` are CRA commands that cannot work. Only `start` is functional, and it sets no `NODE_ENV`. | Fix `start`, delete the rest, set `NODE_ENV`. | TODO |
| **DEP-08** | both backends | **Two competing lockfiles** — `package-lock.json` (689 KB / 700 KB) **and** `pnpm-lock.yaml` (419 KB), with `node_modules` installed from npm. Non-reproducible installs depending on which package manager runs. | Delete one; commit to the other; use `npm ci` in CI. | TODO |
| **DEP-09** | both frontends | `npm run lint` fails in both (`AF-33`, `CF-52`), and `client-frontend`'s ESLint config is itself broken. | Fix, then gate CI on lint. | TODO |
| **DEP-10** | client-frontend | 8 unused deps + `vite@7.0.6` (predates the 7.0.7+ dev-server patches). See `CF-51`, `CF-48`. | Remove; bump Vite. | TODO |
| **DEP-11** | admin-frontend | `@radix-ui/react-icons` unused; `autoprefixer`+`postcss` redundant under Tailwind v4. See `AF-34`. | Remove. | TODO |
| **DEP-13** | both backends | **Shared helpers are hand-copied between the two services, not shared.** `middlewares/validate.js` is byte-identical in both; `utils/safeError.js` differs only in its doc comment, with an identical `DUPLICATE_FIELDS` list that must be kept in sync by hand. `dbOps/withTransaction.js` currently exists only in admin-backend and needs the same code in client-backend.<br><br>Maintaining these by copying is how they silently drift: a fix applied to one side and forgotten on the other produces two services that disagree about, for example, what a duplicate-key error means. It also makes a blind `cp` tempting, which destroys any legitimate divergence.<br><br>Not fixed now — extracting a shared package (npm workspace, or a `shared/` directory both services require) is a build-and-deploy change affecting both Render services, which is not a thing to attempt mid-remediation. **Until then, any edit to `validate.js` or the `DUPLICATE_FIELDS` list must be applied to BOTH copies explicitly** — never with `cp`, which would overwrite service-specific content. | Extract to a shared module. | TODO |
| **DEP-12** | all four | No CI pipeline exists. `AF-17` (case-mismatched imports) would have been caught instantly by a Linux build. | Add CI: install → lint → build on Linux. | TODO |

---

---

## 15. Phase 5.5 — verification sweep (2026-08-29)

Every open CRITICAL / HIGH / MEDIUM finding re-tested **against running code**, not by reading it.
That distinction earned its keep twice already: `CF-06` looked correct in source and was dead in
practice, and `AB-42`'s real cause sat three files from where the finding pointed.

**Result: 47 re-tested — 14 already fixed, 2 partial, 31 genuinely open.**

The register's status column had drifted in *both* directions, which is why this pass existed.
Two of my own sweep checks were also wrong on the first attempt and were corrected: a naive grep
flagged `AB-05b` and `CB-14` as open when both were already closed, and a wrong-indentation regex
missed `CB-16`'s duplicate keys entirely. Verdicts below are from reproduction, not inspection.

| ID | Verdict | Finding | Evidence |
|---|---|---|---|
| **CB-12** | ✅ ALREADY FIXED | 19 raw error.message responses | 0 remain; forced DB error returns generic text |
| **AB-05b** | ✅ ALREADY FIXED | raw error.message in admin 500s | only a deliberate 400/404/409 pass-through of OUR OWN admin-facing messages; 500 path generic |
| **CB-14** | ✅ ALREADY FIXED | appConstants ReferenceError | only referenced in comments documenting the fix |
| **AB-32** | ✅ ALREADY FIXED | console.error of full mysql2 objects | 0 raw-object logs; 23+32 sanitizeError calls |
| **CB-25** | ✅ ALREADY FIXED | soft-deleted products purchasable | is_deleted filter present in getCart and getWishlist |
| **CB-26** | ✅ ALREADY FIXED | nonexistent product_id accepted | FK rejects: ERROR 1452 fk_cart_product |
| **CB-32** | ✅ ALREADY FIXED | multiple product_stock rows | unique index rejects: ERROR 1062 |
| **CB-23** | ✅ ALREADY FIXED | undefined overrides column DEFAULTs | 0 NULL statuses; orders.status now NOT NULL |
| **CB-15** | ✅ ALREADY FIXED | res.user_status_id typo | gone |
| **CB-33** | ✅ ALREADY FIXED | POST /api/order/add-item | route deleted, returns 404 |
| **AB-14** | ✅ ALREADY FIXED | no transactions in productManager | 3 withTransaction uses |
| **AB-09** | ✅ ALREADY FIXED | unauthenticated 50MB Cloudinary upload | both upload routes 401 anon; 5MB/file cap. Residual 10x5MB per request is authenticated-admin only |
| **AF-14** | ✅ ALREADY FIXED | RecentOrders.js mock PII | file deleted |
| **AF-19** | ✅ ALREADY FIXED | destructive actions gated only by window.confirm | server 401s anonymous DELETE; confirm is now UX only |
| **AF-05** | 🟡 PARTIAL | localStorage as identity | admin_token write gone and AF-02 replaced the auth gate with /api/verify-token. admin_auth + admin_user JSON still written - XSS-exfiltratable hints, no longer the gate |
| **CB-09** | 🔴 STILL OPEN | role_id and pri_email cookies | VERIFIED still set on login: role_id=2, pri_email=... Both httpOnly so the frontend cannot even read them; role_id is already in the JWT |
| **AB-11b** | 🔴 STILL OPEN | SELECT * pulls the bcrypt hash | 3 sites. NOT leaked to the client (verified) - defence in depth only |
| **CB-16** | 🔴 STILL OPEN | duplicate object keys | login.getUserDetails x2, order.getOrdersByUser x2. Earlier definitions are dead code |
| **CB-27** | 🔴 STILL OPEN | signup enumeration oracle | VERIFIED 409 for existing vs 201 for new |
| **AB-19e** | 🔴 STILL OPEN | login timing enumeration | VERIFIED 0.06s existing vs 0.00s unknown - measurable oracle |
| **AB-10** | 🔴 STILL OPEN | double Cloudinary upload, orphans forever | 2 upload sites; ZERO destroy calls anywhere in admin-backend |
| **AB-20** | 🔴 STILL OPEN | client filename into Cloudinary public_id | public_id: `${Date.now()}-${file.originalname}` |
| **AB-21** | 🔴 STILL OPEN | file type from client mimetype | file.mimetype.startsWith("image/") |
| **AB-27** | 🔴 STILL OPEN | Cloudinary configured twice | config/cloudinary.js:3 and middlewares/cloudinaryUpload.js:5 |
| **AB-31** | 🔴 STILL OPEN | product.category free text vs category table | 8 distinct product values vs 7 category rows - they disagree |
| **AF-08** | ✅ FIXED (Slice 4) | write-only categoryProducts cache | still written in AddProduct and UpdateProduct, read by nothing |
| **AF-10** | ✅ FIXED (Slice 4) | optimistic status write, no rollback | setOrders before the request; res.json() before res.ok; failure only console.error |
| **AF-12** | ✅ FIXED (Slice 4) | blob URL leak | UpdateProduct creates object URLs and never revokes them |
| **AF-13** | ✅ FIXED (Slice 4) | collections fetch has no .catch | unhandled rejection on any non-JSON response |
| **AF-21** | ✅ FIXED (Slice 4) | debug panel in production | debugLog + "Tips for Exact Matching" still rendered |
| **AF-22** | ✅ FIXED (Slice 4) | no AbortController on admin fetches | 0 in AdminHomePage and AllProducts |
| **AF-23** | ✅ FIXED (Slice 4) | AllProducts can hang on Loading forever | loading starts true, fetch gated on if(categoryName) |
| **AF-24** | ✅ FIXED (Slice 4) | shotgun payload | sends 6 keys; server reads only order_id and status |
| **AF-25** | ✅ FIXED (Slice 4) | undeclared global `event` | Columns.jsx:197 - throws in Firefox/Safari, alert already claims success |
| **CF-11** | ✅ FIXED (Slice 5) | wishlist not cleared on logout | removes user_id/name/email/cart, NOT wishlist - leaks to next user on a shared device |
| **CF-12** | ✅ FIXED (Slice 5) | array-index-keyed wishlist removal | dynamicWishListItem[index] |
| **CF-14** | ✅ FIXED (Slice 5) | Buy Now not awaited before navigate | handleAddToCart then navigate("/checkout") |
| **CF-15** | 🔴 STILL OPEN | wishlist renders Rs. undefined | VERIFIED: API returns selling_price, UI reads discounted_price. Also leaks is_deleted/created_at/updated_at via p.* |
| **CF-17** | ✅ FIXED (Slice 5) | optimistic updates, no rollback | 5 catch blocks, effectively no restore |
| **CF-18** | ✅ FIXED (Slice 5) | newsletter form has no onSubmit | native GET reload on every page carrying the footer |
| **CF-20** | ✅ FIXED (Slice 5) | no client-side stock check | storefront reads stock nowhere; in_stock now available and unused |
| **CF-21** | 🔴 STILL OPEN | fabricated reviews as testimonials | reviews.js still rendered under "Our Happy Customers" |
| **CF-23** | ✅ FIXED (Slice 5) | apartment collected then discarded | shipping_address omits it - misdeliveries |
| **CF-24** | ✅ FIXED (Slice 5) | no AbortController, uncleaned timer | 0 AbortController; setTimeout with no cleanup |
| **CF-25** | ✅ FIXED (Slice 5) | thumbnail modulo duplicates | (currentBestIndex + offset) % bestSellers.length |
| **AF-09** | 🟡 PARTIAL | money computed in the browser | revenue and order totals now server-computed (Slice 2, Slice 4). Residual: DisplayOrderPage still multiplies price x qty per line for DISPLAY, and derives subtotal as amount - shipping_fee. Both are display-only from server-supplied numbers, not authority |
| **AF-01** | 🔴 STILL OPEN | admin credentials still live | VERIFIED: admin123@gmail.com / "admin123" logs in (200). Hash is still cost 10, i.e. the original DB-08 shared hash. Owner action - SEC-02b |

### What this changes

- **14 findings** were closed by Phases 1–5 without their rows being updated. They are now marked.
- **31 remain genuinely open**, of which none are CRITICAL except `AF-01` — which is the owner's
  credential rotation (`SEC-02b`), not a code fix. Verified still live: `admin123@gmail.com` /
  `admin123` returns **200**, on the original cost-10 `DB-08` shared hash.
- **`AF-05` and `AF-09` are partial** — the dangerous half of each is fixed (localStorage is no
  longer the auth gate; revenue and order totals are server-computed). What remains is hygiene.

### Newly observed during the sweep, not previously recorded

- **`getWishlist` uses `p.*`**, so an authenticated wishlist response carries `is_deleted`,
  `created_at`, `updated_at` and `is_new_release`. Same pattern as `CB-35`, which was closed in
  Slice 3 — this sibling was missed. Fold into the `CF-15` fix, which touches the same query.
- **`AB-19e` is measurable, not theoretical**: 0.06s for an existing account vs 0.00s for an
  unknown one. Combined with `CB-27`'s 409-vs-201 signup response, account existence is
  discoverable two independent ways.

## 12. Confirmed FALSE POSITIVES

**Do not spend time on these.** Each was claimed by an earlier audit pass and disproven by reading
the code. They are recorded here so nobody re-adds them.

| Claim | Verdict & proof |
|---|---|
| **"Client sends price → attacker can order for ₹1"** *(was rated the #1 CRITICAL)* | **NOT EXPLOITABLE.** `Checkout.jsx:130` does send `total_amount` and `:137-139` does send per-item `price` — but `customerController.js:579` destructures **only** `user_id, shipping_address, payment_method, payment_status, status`. The server recomputes `total_amount = Σ(selling_price × quantity)` from the DB cart (`:587-601`), with `item.price` aliased from `p.selling_price` (`sqlQueries.js:187`). Forging `localStorage["cart"]` with `discounted_price: 1` changes the **displayed** number and nothing else. **Still delete the dead payload** — it is a loaded gun aimed at whoever next refactors the server — but it is not a money hole. The real money holes are `CF-01`, `CF-02`, `CF-03`, `CB-03`, `CB-04`. |
| "localStorage cart prices flow into the order total" | **FALSE.** Display only. Per the row above. |
| **"SQL injection somewhere in the backends"** | **NONE EXISTS.** All ~55 queries across both backends are static string literals in `sqlQueries.js` with bound parameters. `grep -n '\${'` on both query files returns nothing. No dynamic `ORDER BY`, no dynamic `LIMIT`, no concatenated `IN`, no interpolated identifiers. The only non-trivial binding is `insertImage`'s `VALUES ?` with a nested array — mysql2's documented, escaped bulk-insert form. **This is genuinely the strongest part of the codebase.** (Type confusion via non-scalar params is a separate real issue — `AB-11`, `CB-29`.) |
| **"Mass assignment — `req.body` spread into INSERT/UPDATE"** | **FALSE in both backends.** `adminController.js:164, :254` do pass `req.body` wholesale to the manager, but `adminDbOps.createProduct`/`updateProduct` bind an **explicit fixed field list**; extra keys are discarded. Same in client-backend. |
| **"Client can set `role_id` at signup → escalate to admin"** | **FALSE.** `customerController.js:23-29` passes only five named fields, and `customerDbOps.js:11-31` destructures exactly those and **hardcodes `2` (CUSTOMER)**. `Signup.jsx:46` sends no privileged field either. Admin is `role_id = 0`, unreachable. |
| **"Stock can be driven negative"** | **FALSE.** `sqlQueries.js:263-266` is `UPDATE product_stock SET stock_qty = stock_qty - ? WHERE product_id = ? AND stock_qty >= ?` — a guarded single statement, atomic under InnoDB row locks. The real consequence of the TOCTOU window is the **inconsistent partial order** (`CB-06`), not oversell. |
| **"Password hash is leaked to the client"** | **FALSE in both backends.** `SELECT *` does pull `pass` into memory (`AB-11b`, and `client-backend/sqlQueries.js:16`), but every response hand-picks fields. Defence-in-depth smell, not a disclosure. |
| **"No request body size limit → unbounded DoS"** | **FALSE.** Verified in the installed `body-parser/lib/utils.js:62-64`: `express.json()` defaults to `100kb`. The genuinely unbounded surface is **multer** (`AB-09`). |
| **"`GET /api/:productId` is a catch-all shadowing the other routes"** | **FALSE.** Tested against this repo's own matcher. Two independent reasons it is safe: Express 5 `:param` never matches across `/`, so every multi-segment route is untouched; and the three single-segment GETs (`/collections`, `/bestsellers`, `/categories`) are registered **before** `/:productId`. Within-group ordering is also correct. It **is** fragile — see `CB-39`. |
| **"Unhandled promise rejections will crash the process"** | **OVERSTATED.** All 22 client-backend handlers are `try/catch`-wrapped and Express 5 auto-forwards async rejections. The real residual gap is the **missing custom error handler** + unset `NODE_ENV` → stack traces in responses (`AB-18`, `CB-13`). |
| "`console.warn` in `MyOrders`/`MyProfile` leaks auth internals" | **FALSE.** The actual strings are `"⛔ No 'user_id' found in localStorage."` and `"No User ID found. User might be guest."` — they log the **absence** of a value, no credential, and only to the user's own console. (The real logging concerns are `AF-03` — 18 PII sites in admin-frontend — and `AB-32` — mysql2 params in backend stdout.) |
| "`adminDetails.js` is a client-side auth mechanism" | **HALF FALSE, and the truth is worse.** `grep -rn "adminDetails\|loginDetails" src/` returns exactly one hit: its own declaration. It is **imported by nothing**. Login *is* server-verified with bcrypt (`AF-*` Section E). So it is not an auth bypass — it is a **plaintext working production credential in a public repo** (`SEC-02`). Deleting the file is safe and changes nothing about login. |
| "`ContextApp.jsx` is dead code" | **HALF FALSE.** `main.jsx:10-12` mounts `LoginDetailsProvider` around the whole app, so the `useEffect` runs on every page load and **does** write localStorage. What is dead is the *consumer* side — nothing calls `useContext` on it. So the password write is live code that currently only ever writes `""` (`AF-04`). |
| "Cart quantity can be driven zero or negative through the UI" | **FALSE via the UI.** `CartItem.jsx:20` guards `if (itemCount <= 1) return;` and the button is `disabled={itemCount <= 1}`. The **API** accepts anything (`CB-17`) — that is a backend finding, reachable only by calling the API directly. |
| "`Math.random()` React keys / `user_email` in localStorage are significant" | **TRUE but genuinely LOW** (`CF-43`, `CF-46`). `order_id` is always present in practice; a user's own email in their own localStorage is not sensitive by itself. The real issue is that it sits beside the `user_id` that *is* the credential. |
| "Signup has no validation" | **OVERSTATED.** `required` on all five fields, `type="email"`, `minLength={6}` are all present. The accurate finding is *weak* validation — downgraded to `CF-45`. |
| "`getNewReleaseProducts` `SELECT *` is a security issue" | **NOT SECURITY.** The `product` table holds catalogue data only — no credentials, no PII. Code-quality nit (`CB-35`). |
| "XSS somewhere in either frontend" | **NONE.** Verified zero `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `eval(`, `new Function`, `document.write`, `insertAdjacentHTML`, `javascript:` across both `src/` trees. No API-derived `href` anywhere. API data reaches only `<img src>`, which is not a script sink. **Preserve this property** — and note that if XSS ever does land, the localStorage tokens (`AF-05`, `CF-05`) are trivially stolen, and neither app has a CSP. |

---

## 13. Deferred work

| Item | Decision | Notes |
|---|---|---|
| **`INFRA-01` — move the backends onto `paisilks.com` subdomains** | **DEFERRED — do this LAST, after every other phase.** User decision: DNS changes are risky close to launch. | **Why it matters:** the storefront (`paisilks.com`) and the APIs (`*.onrender.com`) are different registrable domains, so every production API call is **cross-site**. That forces `sameSite: 'none'` on the auth cookies, which gives up the CSRF protection `sameSite: 'lax'` would provide. Local dev hides this completely — `localhost:9033` → `localhost:9034` is same-site, so `'strict'` would pass every local test and fail only in production.<br><br>**The fix is DNS only — the backends stay on Render.** Render supports custom domains on all tiers, with automatic HTTPS.<br><br>`api.paisilks.com` → client-backend · `admin-api.paisilks.com` → admin-backend<br><br>Steps: Render → Settings → Custom Domains → add the name; create the CNAME it shows you in the Hostinger DNS zone; wait for the cert; update `VITE_CLIENT_API_BASE` / `VITE_ADMIN_API_BASE` and rebuild the frontends; then set `CORS_ORIGINS` accordingly.<br><br>**Once live, change `sameSite` from `'none'` back to `'lax'`** in both `utils.js` — that is the whole point of the exercise. Subdomains of `paisilks.com` count as same-site, so `admin.paisilks.com` already qualifies; only the two backends are the outliers.<br><br>Side benefits: cleaner URLs, and the frontends stop being coupled to Render — a future host change becomes a DNS repoint rather than a code change. |
| **Razorpay integration** | **DEFERRED** — client has not paid for this scope yet. | Purely additive; nothing in this plan needs to be undone. Only three files change: two new routes in `client-backend/src/routes/customerRoutes.js` (`/initiate-payment`, `/verify-payment`), two new handlers, and the submit path in `Checkout.jsx`. **Until it lands, `CF-01` must be fixed** so orders are `Pending`/`Unpaid` rather than falsely `Paid`. Server must compute the amount from the DB, create the Razorpay order, and mark paid **only** after verifying the signature with `crypto.createHmac`. |
| **India Post tracking API** | **DEFERRED** — approval takes weeks to months (government process); go-live is in days. | Interim: expand the `orders.status` enum to `Pending → Confirmed → Packed → Shipped → Out for Delivery → Delivered`, add `orders.consignment_number` (`DB-09`), let the admin set it, and show the customer the number plus a link to `indiapost.gov.in` tracking. When the API key arrives, swap the link for live in-app tracking — nothing else changes. |
| **`INFRA-02` — API ownership: admin APIs in admin-backend, client APIs in client-backend** | **DEFERRED — owner decision, 2026-08-28. Do this AFTER all phases complete**, alongside `INFRA-01`. | Right now the two services call each other's APIs, in both directions, and neither owns a clean surface:<br><br>**admin-frontend → client-backend:** `AddProduct.jsx:62` fetches `/api/collections` from the storefront API. (The bestsellers cross-call was removed in Phase 5 Slice 2 — the admin dashboard now uses its own `get-bestSeller-list`.)<br><br>**client-frontend → admin-backend (`CF-22`, HIGH):** the storefront fetches its entire catalogue from `admin-backend`'s `get-all-product-details`, exposing `stock_qty` and internal timestamps to anonymous visitors and coupling shop availability to the admin service. The client backend's own product endpoints go unused.<br><br>**Why it is deferred rather than done inline:** it is not a rename. Each moved endpoint needs its query rebuilt to fit its real consumer — the admin needs stock and internal fields, the storefront must never see them — plus its own validation, auth posture and response shape. Done piecemeal it would leave both services half-migrated with two partial surfaces, which is worse than the current state.<br><br>**Scope when it happens:** inventory every cross-service call in both frontends; for each, decide the owning service; build the endpoint there *shaped for that consumer*; re-point the caller; delete the old route. Then `CORS_ORIGINS` can drop each service's cross-domain entry (`DEPLOYMENT.md` already notes this for `admin-backend`).<br><br>⚠️ **`CF-22` is currently scheduled as Phase 5 Slice 5.** It is the same theme as this item. Confirm with the owner whether it stays in Phase 5 or folds in here — it is the one cross-call with a real security consequence, so leaving it until after every phase is a deliberate risk acceptance, not a default. |
| **Images: Cloudinary → AWS S3** | **DEFERRED — owner decision, 2026-08-29: after the client pays, same as Razorpay.** | **The catch that makes this more than a swap:** `cloudinaryUpload.js` sets `format: "webp"`, so Cloudinary is **re-encoding every upload**. A 3 MB phone photo becomes a ~200 KB WebP automatically. **S3 stores bytes and transforms nothing** — a naive swap would serve the client's original multi-MB JPEGs and make the storefront slower, not cheaper. The migration needs **Sharp** in the backend to resize and convert before upload (~20 lines, no extra cost, recommended over Lambda/Lambda@Edge for this scale).<br><br>**Cost, at ~1,000 images of ~300 KB:** S3 storage ≈ ₹1/mo, CloudFront delivery ≈ ₹45/mo. Cloudinary is free until 25 credits then jumps to ~₹7,400/mo. The owner's instinct that S3 is cheaper is correct.<br><br>**Scope when it happens:** Sharp pipeline → S3 upload → CloudFront distribution → rewrite `product_images.image_url` for the 138 existing rows (or re-upload from Cloudinary) → delete the Cloudinary account only after verifying every URL resolves.<br><br>⚠️ **`AB-20`, `AB-21` and the delete-on-replace half of `AB-10` are NOT Cloudinary-specific** — a crafted filename traverses S3 keys the same way, `mimetype` is still client-supplied, and S3 orphans files just as permanently. They are fixed now against Cloudinary; the rules port unchanged, only the API call differs. Only the *double upload* (`multer-storage-cloudinary` artefact) and `AB-27` (double config) become moot.<br><br>**What Slice 3 built that carries straight over:** `utils/cloudinaryAssets.js` is the delete-on-replace layer — for S3 it becomes `DeleteObjectsCommand` and `publicIdFromUrl` becomes "derive the S3 key from the URL", but the *call sites* in `productManager` do not change. Server-generated random `public_id`s become S3 object keys unchanged. The post-commit cleanup ordering (delete only after the transaction commits, never throw) is storage-agnostic and should be preserved.<br><br>⚠️ **RUN `scripts/find-orphaned-images.js` BEFORE MIGRATING.** As of 2026-08-29 there are **111 orphaned assets (2.9 MB, 17% of stored bytes)** left over from the double-upload era. Migrating without clearing them copies 111 dead files into S3 and pays to store them there too. Run it against **production**, not local — the two databases have diverged, and deleting against the wrong one destroys images the other still uses.<br><br>⚠️ **A URL returning HTTP 200 does not prove the asset exists.** Verified during Slice 3: after a successful `destroy()`, the old Cloudinary URL still answered 200 from CDN cache. Verify the migration against the **S3/Cloudinary API listing**, not by fetching URLs — otherwise the "delete Cloudinary only after every URL resolves" step above will give a false pass. |
| **Backend hosting: Render → AWS** | **WON'T FIX (for now) — evaluated 2026-08-29, no benefit at this scale.** | Moving the two Node backends to AWS cascades: the database is on Hostinger, so every query would cross the internet, which pushes you to RDS (+~₹1,200/mo plus a migration). Costed alternatives for both services: Render Starter ~₹1,200/mo (zero ops), Railway ~₹850, Fly.io ~₹500–800, Hostinger VPS ~₹400–800 (but you own OS patches, PM2, nginx and SSL renewal).<br><br>**The actual problem is not price — it is the Render FREE tier spinning down after 15 minutes idle**, giving 30–50s cold starts and sometimes an HTML error page where JSON is expected (that is what `CF-26` describes). Upgrading to a paid tier removes it without changing anything else.<br><br>**Recommendation: stay on Render, upgrade to Starter when the client pays** — billable to the client as hosting, same as S3. `INFRA-01` (the `api.paisilks.com` subdomain move) is DNS-only and works identically on any of these hosts, so this decision does not block it. |
| **Product reviews — verified-purchase, star-rated** 🆕 | **DEFERRED — owner decision, 2026-08-29. Build LAST, after every Phase 5.5 and Phase 6 item is closed.** Owner asked explicitly not to interleave it with the hardening. | **This supersedes `CF-21`.** The five fabricated testimonials in `reviews.js` stay in place until this ships; `CF-21` is therefore held open rather than fixed by deletion, and `reviews.js` must NOT be deleted — under the likely fallback option it becomes the zero-state.<br><br>**Scope agreed so far:** only a customer who actually **bought** the product may review it; star rating plus a comment; the homepage shows a **top 10**; dummy reviews give way to real ones once they exist.<br><br>**Design sketched (not built):**<br>• `migrations/009` — `product_reviews (review_id, product_id FK, user_id FK, order_id FK, rating TINYINT 1..5, comment VARCHAR(500), created_at, is_deleted)` with `UNIQUE (user_id, product_id, order_id)`. The `order_id` column is what makes "verified purchase" *enforceable* rather than a claim; the UNIQUE stops one customer flooding a product.<br>• Client backend: `POST /api/reviews` (verifies the order belongs to the caller, contains that product, is Delivered, and has not already been reviewed), `GET /api/products/:id/reviews`, `GET /api/reviews/top`, `GET /api/orders/reviewable`.<br>• Client frontend: review form on **MyOrders** for delivered items; reviews on `ViewProductPage`; homepage section reads real data.<br>• Admin: a reviews list with the ability to hide one — **required**, not optional; someone will eventually post abuse.<br><br>⚠️ **ASK THE OWNER THESE FOUR QUESTIONS BEFORE BUILDING — they were raised on 2026-08-29 and deliberately left unanswered until this work starts:**<br>**Q1.** Review allowed after purchase generally, or only once the order reaches **Delivered**? *(recommended: Delivered — reviewing an unarrived saree is meaningless, and the state already exists in the enum.)*<br>**Q2.** What does "top 10" mean — (a) highest rated with newest as tiebreak, (b) most recent 10, or (c) highest rated but 4★ and above only? *(recommended: **b** — with (a), once fifty 5★ reviews exist the homepage freezes on the same ten permanently.)*<br>**Q3.** Fallback while real reviews are few — (a) hide the section until real ones exist, (b) keep the dummies but label the section honestly as samples, or (c) show real only when ≥1 exists and dummies only when zero, never mixed? *(recommended: **c** — closest to the owner's stated intent, and it avoids the actual exposure. The risk is not the dummies existing; it is **mixing invented reviews with genuine ones, displayed identically**, so a visitor cannot tell which is which. That is what India's CCPA/BIS fake-review framework targets. Option (c) means the moment one real review lands, every dummy disappears.)*<br>**Q4.** Confirm this is billable scope to the client, like Razorpay and the S3 migration. |
| **WhatsApp OTP — phone login + password reset** 🆕 | **DEFERRED — owner decision, 2026-08-29. Replaces the earlier "self-service password reset" entry**, which was blocked purely on having no send channel. The client is purchasing WhatsApp Business API access, which unblocks it. | **Two features, one shared mechanism.** (a) Login via phone + a WhatsApp OTP, alongside the existing email + password login. (b) Password reset: a one-time code on WhatsApp which the customer enters to set a new password.<br><br>⚠️ **CONFIRM WITH THE CLIENT WHAT THEY ARE ACTUALLY BUYING.** Three different things get called "the WhatsApp API": the free **Business App** (cannot send programmatic OTPs), **green-tick verification** (a badge, not API access), and the **WhatsApp Business Platform / Cloud API** (what is required, direct from Meta or via a BSP such as Interakt / AiSensy / Gupshup / Twilio — a BSP is faster to get live). The client's symptom — repeatedly flagged as fraud and asked their purpose — is consistent with the free Business App tripping automated checks.<br><br>**⛔ PREREQUISITE — do this BEFORE the feature, and ideally early:** `master_user.phone_number` has **no index at all** and is not unique, and numbers are stored in two formats — verified 2026-08-29: **14 of 21** customers as bare `8073706001`, **7** as `+918073706001`. Those are the same phone as different strings, so "which account does this OTP unlock?" would have no answer. Order matters: **(1)** normalise every number to E.164 using the existing `toE164` helper, **(2)** *then* add `UNIQUE` on `phone_number`. Verified **0 collisions today**, so this is clean now and gets harder with every new customer.<br><br>**Design:** one `otp_codes` table — `(id, user_id FK, code_hash, purpose ENUM('login','reset'), expires_at, attempts, consumed_at, created_at)`. Reset is the same flow with a different `purpose`. On success, login issues **the same JWT session the password path already issues** (Phase 2), so there is one session model with two ways of proving identity — not a parallel auth path.<br><br>**Security rules that make a 6-digit code safe** (1,000,000 possibilities is trivially brute-forced without all of these): store a **hash** of the code, never the code; expire in 5–10 minutes; single use, consumed on success; cap attempts at 3–5 then invalidate; rate-limit sends per phone **and** per IP (abuse *and* cost). **On a successful reset, DELETE that user's session rows** — otherwise an attacker with a live session stays logged in and the reset changes nothing.<br><br>⚠️ **A phone-login endpoint that replies "no account with this number" is a NEW enumeration oracle** — `CB-27` on a fresh route. Design the response uniformly from day one rather than retrofitting.<br><br>**This is also the proper fix for `CB-27`**: with a real send channel, "if this account is new we have sent you a code" becomes true rather than a lie, and the existing owner gets warned someone probed their account. Until then `CB-27` is mitigated by rate limiting only (Phase 5.5 Slice 2, owner chose option C).<br><br>**Lead time is not under your control** — Meta business verification can take days to weeks, the same trap as the India Post API. **Tell the client to start the application immediately**, independent of when this is built. Once live, the same channel also enables order-status notifications ("your saree has shipped"), which suits Indian customers better than email and needs no extra data — the phone numbers are already there, with 100% coverage. |
| **Order-status notifications over WhatsApp** | **IDEA — only after the OTP work above.** | Same channel, same phone numbers, no new data required. Utility templates rather than authentication ones. Pairs naturally with the DTDC / India Post `consignment_number` work (`DB-09`). | Surfaced by `CF-08`: `LoginPage.jsx` has always linked to `/forgot-password` and the route never existed, so a locked-out customer hit a blank page. Phase 5 Slice 1 gives them a real page that routes to a human — an honest stopgap, not a fix.<br><br>A real reset needs four things this project has none of: **(1)** an outbound mail channel (SMTP credentials and a verified sender domain — note Render blocks outbound SMTP on some plans, so an API-based sender like Resend/SES is the likelier route); **(2)** a `password_reset` table of single-use tokens with a short expiry, storing a **hash** of the token, never the token itself; **(3)** a reset endpoint pair that is rate-limited per email *and* per IP, and that returns the **same** response whether or not the address exists — otherwise it becomes a cleaner account-enumeration oracle than the two already logged in `CB-27`; **(4)** invalidation of the user's existing `session` rows on a successful reset, or a reset does not actually lock an attacker out.<br><br>Until then the owner resets passwords by hand. Do **not** ship a form that pretends to send an email. |
| **MySQL → PostgreSQL migration** | **WON'T FIX (for now)** | Production is on Hostinger, which is MySQL/MariaDB only. Both backends use `mysql2`, and all ~55 queries use `?` placeholders that would need converting to `$1, $2`. No business value before go-live. Revisit only if production moves off Hostinger. |
| **Admin UI conversion to MUI (VoltEdge style)** | **DEFERRED until after hardening** | Tracked separately. Do **not** start it mid-remediation — it would invalidate every file:line reference in this document. |
| **`pai_silks_coming_soon/` audit** | **NOT YET DONE** | Never scanned. Check for secrets, form endpoints, email capture, analytics keys, dependency risk. |
| **`website-backend/` audit** | **NOT YET DONE** | Appears to be an unused stub. Confirm it contains no secrets and no deployable old copy of the routes — dead code that is deployable is still a risk. |

---

## 14. Verification checklist

Tick only when **both** the fix is in place **and** it has been observed working. Do not mark
anything done on the strength of a code change alone.

### Phase 0 — Secrets
- [ ] `SEC-01` Cloudinary secret rotated in the dashboard
- [ ] `SEC-01` `admin-backend/.env` untracked; `.env` + `.env.*` ignored in all four apps **and** at the repo root
- [ ] `SEC-01` git history purged; force-pushed
- [ ] `SEC-02` `adminDetails.js` deleted and purged from history
      *(password rotation itself is `SEC-02b` — see Phase 2)*
- [ ] `SEC-03` `u863032788_db.sql` moved out of the repo tree or encrypted; `*.sql` ignored
- [ ] `SEC-04` `RecentOrders.js` mock data with real phone numbers deleted and purged

### Phase 1 — Stop the bleeding
- [ ] `CF-01` No order can be created with `payment_status: "Paid"` from the client — **verified by curl**
- [ ] `CF-02` Clicking `+` five times produces **one** DB cart row with `quantity: 5` — **verified in the DB**
- [ ] `CF-03` Displayed total equals `orders.total_amount` — **verified against a real order row**
- [ ] `CF-07` New orders have a non-NULL `status` — **verified in the DB**
- [ ] `CF-10` ErrorBoundary in place; corrupting `localStorage["cart"]` no longer blanks the site
- [ ] `AB-02` / `CB-07` CORS rejects an unlisted origin — **verified by curl with a forged `Origin`**
- [ ] `AB-04` / `CB-08` Cookies carry `Secure` + `SameSite=Strict` — **verified in DevTools → Application → Cookies**
- [ ] `AB-05` / `CB-05` Cookie expiry is ~24 h, not the year 238,581 — **verified in DevTools**
- [ ] `AB-03` / `CB-11` The 11th login attempt in 15 min is rejected — **verified by curl loop**
- [ ] `AB-19` / `CB-19` `helmet` headers present; no `X-Powered-By` — **verified with `curl -I`**
- [ ] `AB-18` / `CB-13` A deliberately triggered 500 returns a generic message with **no stack trace**
- [ ] `AF-03` Zero PII-leaking `console.*` calls remain in any of the four apps

### Phase 2 — Auth
- [ ] `SEC-02b` admin **email** changed from `admin123@gmail.com` — local AND production
- [ ] `SEC-02b` admin **password** rotated at bcrypt cost 12 — local AND production
- [ ] `SEC-02b` that admin's `session` rows deleted in the same change (`session.pri_email`
      is a denormalised copy and would otherwise keep the old address)
- [ ] `DB-08` the three accounts sharing one bcrypt hash force-reset
- [ ] bcrypt cost raised 10 → 12 in the signup path
- [ ] `JWT_SECRET` set in both `.env` files; both `.env` files exist and are complete
- [ ] `AB-24` / `CB-24` `genToken` replaced — **shipped in the same commit as the middleware**
- [ ] `AB-01` All 15 admin routes reject an unauthenticated request with 401 — **each verified by curl**
- [ ] `CB-01` All protected client routes reject an unauthenticated request with 401 — **each verified by curl**
- [ ] `AB-08` A non-admin token gets 403 on every admin route
- [ ] `CB-02` User A cannot read or write **any** of User B's cart, wishlist, orders or profile — **all 14 handlers verified**
- [ ] `CB-21` A user with `is_delete = 1` cannot log in
- [ ] `AB-07` / `CB-13` Logout invalidates the session server-side; the old cookie is rejected
- [ ] `AB-28` / `AF-16` **First login succeeds on the first click** — verified with a fresh session
- [ ] `AB-02` / `CB-07` CORS allowlist confirmed live **before** any `credentials: 'include'` was added
- [ ] `AF-15` / `CF-04` All 39 fetches send `credentials: 'include'`; cookies visible in DevTools
- [ ] `CF-05` No request body, path, or query contains `user_id` — **verified in the Network tab**
- [ ] `AF-02` Setting `localStorage.admin_auth = "true"` no longer grants admin access
- [ ] `CF-08` `/my-orders`, `/my-profile`, `/checkout` redirect to `/login` when logged out
- [ ] `AF-06` Logout button clears the session and redirects

### Phase 3 — Validation & errors
- [ ] `express-validator` installed in both backends
- [ ] Invalid `status` rejected with 400 — verified for each of the disallowed values
- [ ] `quantity` of `-1`, `0`, `null`, `"abc"`, `999999`, `[1,2]`, `{}` all rejected with 400
- [ ] Non-numeric `:id` params rejected with 400
- [ ] `AF-18` Product create/update rejects `"abc"`, negative prices, and `selling > regular`
- [ ] `CB-28` / `CF-45` Password policy live (min 8, max 72); phone regex enforced
- [ ] All 38 raw `error.message` responses replaced; **no** DB detail reaches a client
- [ ] `AB-12` / `CB-14` `appConstants` `ReferenceError` gone — verified by forcing a DB error
- [ ] `AB-13` `PUT /update-order-status` with a bogus `order_id` returns 404, not a false 200
- [x] `CF-09` Checkout captures the real phone number — **verified in the DB** *(only true from Phase 5 Slice 2b: the form was fixed in Phase 3, but `createOrder` discarded the value and `orders` had no column until migration 007 — see AB-42)*

### Phase 4 — Database
- [ ] `DB-01` All foreign keys added; inserting an orphan row now fails
- [ ] `DB-02` `cart(user_id, product_id)` unique index live
- [ ] `DB-03` `product_stock(product_id)` unique index live
- [ ] `DB-04` `orders.status` backfilled and `NOT NULL`
- [ ] `DB-08` Shared-hash accounts force-reset
- [ ] `CB-06` Order creation is transactional — **verified by forcing a mid-loop failure and confirming full rollback**
- [ ] `AB-14a/b` Product create and image update are transactional
- [ ] `CB-04` `POST /api/order/add-item` returns 404 (route deleted)
- [ ] Soft-delete enforced everywhere: `CB-21`, `CB-25` (×3 queries), `AB-12s` (×3), `AB-17b`

### Phase 5 — Correctness
- [x] `CF-06` Profile editing actually persists — **verified in the DB** *(Phase 5 Slice 1; route did not exist at all)*
- [x] `AF-17` **Project builds on Linux** — verified by building on a case-sensitive APFS volume (CI itself is still `DEP-12`)
- [x] `AB-16` Admin order totals match `orders.total_amount` for an order with 2 shipment rows *(tested with 2 and 3 rows; also fixed a live bug where the admin under-reported by the ₹100 shipping fee on every order)*
- [x] `AB-17` All four dashboard aggregations corrected and paginated *(Slice 2 — root cause was three disagreeing status vocabularies, not just SQL)*
- [x] `CF-16` `/my-orders` renders without crashing for an order with zero items
- [x] `CF-13` Guest→login merge persists the merged quantity to the DB *(via /api/cart/update; addToCart deliberately left idempotent)*
- [x] `CF-19` `/product/collections` shows a 404, not a garbage product page
- [x] `CF-08` A typo'd URL renders a real 404 page *(plus `/forgot-password` exists and `/animation` is gone)*
- [x] All 7 `CF-C-F1..F7` blank-page crashes confirmed non-fatal behind the ErrorBoundary
      *(done in Phase 1 Slice 4)*
- [x] `AF-C-FIX` admin ErrorBoundary mounted in `admin-frontend/admin/src/main.jsx`
- [x] `AF-C-FIX` `AdminHomePage.jsx:138` guarded — an order missing `product_list` no longer
      silently hides the **entire** order list
- [x] `AF-C-FIX` swallowed crashes at `AdminHomePage.jsx:91, :120` guarded, and their `.catch`
      blocks no longer discard real errors
- [x] `AF-C-FIX` no `₹NaN` renders anywhere in the admin panel

### Phase 6 — Hygiene
- [ ] `DEP-01` Frontend deps and `public/` removed from both backends
- [ ] `DEP-02` `bcryptjs` removed · `DEP-03` `crypto` removed · `DEP-05` `nodemon` moved
- [ ] `DEP-08` One lockfile per app
- [ ] `AF-07` / `CF-*` All 37 hardcoded API URLs replaced with env vars
- [ ] `DEP-09` `npm run lint` passes in both frontends
- [ ] `DEP-12` CI pipeline live: install → lint → **Linux build**
- [ ] `CF-50` 19 dead CSS files + dead JS/JSX deleted · `CF-51` 8 unused deps removed
- [ ] `CF-48` ngrok host removed from `vite.config.js`; Vite bumped
- [ ] `CF-53` Real README written

### `INFRA-01` — after everything else is complete
- [ ] `api.paisilks.com` added as a Render custom domain on client-backend; CNAME live; cert issued
- [ ] `admin-api.paisilks.com` added as a Render custom domain on admin-backend; CNAME live; cert issued
- [ ] `VITE_CLIENT_API_BASE` / `VITE_ADMIN_API_BASE` updated in both `.env.production`; frontends rebuilt and redeployed
- [ ] `CORS_ORIGINS` updated in Render for both services
- [ ] **`sameSite` switched from `'none'` to `'lax'`** in both `utils.js` — the reason for the whole change
- [ ] Login verified end to end on production after the switch

### Final go-live gate
- [ ] No order can be created without a real payment (or `payment_status` is server-controlled and defaults to unpaid)
- [ ] No endpoint returns another user's data — spot-checked across all 14 IDOR handlers
- [ ] No secret exists in any bundle, any tracked file, or any git object
- [ ] Both `.env` files complete; no hardcoded credential fallback remains in either `db.js`
- [ ] `npm audit` reviewed in all four apps
- [ ] A full manual pass of: signup → login → browse → add to cart → wishlist → checkout → view order → admin sees the order → admin updates status → customer sees the new status → logout
