const rateLimit = require('express-rate-limit');

/**
 * Rate limiters for the admin authentication endpoint.
 *
 * /api/admin-login was not throttled at all — a script could attempt unlimited
 * passwords per second against a single known admin account. Combined with the
 * timing side channel in adminDbOps.js (AB-19e), which reveals whether an
 * email exists, this was a fully open brute-force target. See CLAUDE.md AB-03.
 *
 * IMPORTANT — on Render the app runs behind a reverse proxy, so req.ip is the
 * proxy's address unless `trust proxy` is set (done in server.js). Without it
 * every request appears to come from one IP and the limiter would throttle all
 * users collectively rather than per-client.
 */

const jsonMessage = (message) => ({ success: false, message });

/**
 * Admin login. Tighter than the customer limiter: there is only one admin
 * account, so a legitimate user has no reason to fail 10 times.
 *
 * `skipSuccessfulRequests` means only FAILED attempts count, so the real admin
 * is never locked out by normal use.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // failed attempts per IP per window
  skipSuccessfulRequests: true,
  standardHeaders: true,    // RateLimit-* response headers
  legacyHeaders: false,
  message: jsonMessage(
    'Too many login attempts. Please try again in 15 minutes.'
  ),
});

/**
 * Limiter for the WRITE endpoints — writes only, as the name says.
 *
 * ⚠️ This used to count EVERY request, reads included, at 100 per 15 minutes.
 * One dashboard load is 5 GETs, doubled to ~10 by React StrictMode in
 * development, so the panel died at roughly the tenth refresh — and because the
 * frontend treated any non-OK response as "not logged in", the 429 looked
 * exactly like being logged out.
 *
 * Page views are now governed by pageLoadLimiter below, which counts page loads
 * directly rather than inferring them from a request total. That number cannot
 * drift when a screen gains another API call; this one no longer moves when a
 * page is added.
 *
 * What still warrants a cap here is the expensive and destructive surface:
 * image upload into a paid Cloudinary account (AB-09), product deletion, bulk
 * writes. All non-GET, which is what `skip` keys on.
 */
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // OPTIONS is a CORS preflight the browser sends on its own — never charge a
  // user's budget for a request they did not make.
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: jsonMessage('Too many requests. Please slow down.'),
});

/**
 * PAGE-LOAD limiter — the owner's "10 refreshes, then a lockout page" rule.
 *
 * Mounted on /api/verify-token ALONE, and that is the whole design. Every admin
 * page load calls that endpoint exactly once, through ProtectedAdminRoute, so
 * counting it counts page loads directly. Trying to express "10 refreshes" as a
 * total request budget was what produced the original bug: the real limit moved
 * every time a screen gained or lost an API call, and nobody noticed until the
 * panel locked itself.
 *
 * A one-HOUR window, matching the message the user is shown.
 *
 * ⚠️ DOUBLED IN DEVELOPMENT, on purpose. React StrictMode deliberately invokes
 * effects twice in dev, so one refresh issues two verify-token requests. Without
 * this the developer would be locked out after 5 refreshes while production
 * allowed 10 — the same limit behaving differently in the two places it is
 * tested, which is how the original problem stayed hidden.
 *
 * `skipFailedRequests` is deliberately NOT set: a hammering client that is
 * getting 401s is exactly what this should catch.
 */
const PAGE_LOADS_PER_HOUR = 10;

const pageLoadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour — matches the "try again in an hour" copy
  max: process.env.NODE_ENV === 'production'
    ? PAGE_LOADS_PER_HOUR
    : PAGE_LOADS_PER_HOUR * 2, // StrictMode double-invoke, see above
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  // A distinct `code` so the frontend can tell THIS apart from an ordinary
  // 401. They are different situations and must not look alike to the user:
  // one means "log in", the other means "wait, or verify by email".
  message: {
    success: false,
    code: 'PAGE_LOAD_LIMIT',
    message:
      'You have opened the admin panel too many times in a short period. ' +
      'Please try again in an hour, or verify your identity by email.',
  },
});

module.exports = { loginLimiter, writeLimiter, pageLoadLimiter };
