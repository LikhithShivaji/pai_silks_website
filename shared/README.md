# `shared/`

Code used by **both** `admin-backend` and `client-backend`. One copy.

**This is not a service.** It does not run, listen on a port, or have a URL. It
is files the two backends read at boot, the same way they read anything in
`node_modules`. It needs no hosting and costs nothing to deploy.

## What's here

| File | What it does |
|---|---|
| `safeError.js` | `sanitizeError` — strips customer data out of mysql2 errors before they reach a log. `makeDescribeDuplicate` — builds a duplicate-key describer from a per-service constraint list. |
| `validate.js` | `validate` — turns express-validator failures into one 400 response. `rejectNonScalarBody` — refuses arrays/objects in a request body, which corrupt mysql2 placeholders. |
| `withTransaction.js` | `createWithTransaction(pool)` — wraps a unit of work in begin/commit/rollback. A factory because each service owns its own pool. |

## Why it exists

These three files used to exist **twice**, once per backend — 86 lines of
identical code. Nothing kept them in sync except a comment.

That is not a theoretical risk. `safeError.js` was fixed twice during
development, both times for the same leak:

```
attempt 1  redacted `sql` but kept `message`   → still leaked the customer's email
attempt 2  redacted message + sqlMessage       → still leaked via `stack`
attempt 3  redacted all three                  → correct
```

Each fix had to be applied to both copies by hand. Fixing only one would have
left the admin panel printing customer email addresses into its logs, with
nothing to indicate the two services disagreed.

See `CLAUDE.md` → `DEP-13`.

## What does NOT belong here

Anything a service can legitimately do differently.

The clearest example is the list of UNIQUE constraints in each backend's
`src/utils/safeError.js`. Those lists are **supposed** to differ — admin-backend
writes to `product` and `category`, client-backend writes to `cart` and
`wishlist`, and neither can violate the other's constraints. Both copies used to
carry all six entries, which is what made them look like duplicates needing
sync. They aren't: each service now declares only its own surface, and
`makeDescribeDuplicate` takes that list as an argument.

Same principle for validation: the **mechanism** is shared, the **rules** live
in each service's own `middlewares/validators.js`.

## Import paths are unchanged

Each backend keeps a thin file at the original location that re-exports from
here:

```
client-backend/src/utils/safeError.js       →  shared/safeError.js
client-backend/src/middlewares/validate.js  →  shared/validate.js
client-backend/src/dbOps/withTransaction.js →  shared/withTransaction.js
```

So the 16 files that import these were not touched. Anything requiring
`../utils/safeError` still works exactly as before.

## Deploying

⚠️ **`shared/` has its own `package.json` and must be installed**, or both
backends die on boot with `Cannot find module 'express-validator'`. Node
resolves dependencies by walking *up* from `shared/`, and the backends' own
`node_modules` are in their folders, not above this one.

Render build command:

```
npm --prefix shared ci && cd client-backend && npm ci
```

and Root Directory must be **blank** (the repo root), so `shared/` is uploaded
at all. Full detail in `DEPLOYMENT.md`.
