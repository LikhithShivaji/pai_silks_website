# Deployment

## Architecture

```
Hostinger (static hosting)  ←  dist/ upload   ←  frontends
Render (Node services)      ←  git push       ←  backends
Hostinger MySQL             ←  live database
```

| Component | Hosted on | Deploy method |
|---|---|---|
| `admin-frontend/admin` | Hostinger | upload `dist/` |
| `client-frontend/client` | Hostinger | upload `dist/` |
| `admin-backend` | Render | git push |
| `client-backend` | Render | git push |
| Database | Hostinger MySQL | — |

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
JWT_SECRET    (added in Phase 2)
```

`admin-backend` additionally needs:

```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

> Hostinger MySQL must permit remote connections from Render's IPs, otherwise
> the backend cannot reach the database.

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
