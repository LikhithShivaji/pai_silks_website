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
 * Blanket limiter for the write endpoints.
 *
 * Every admin route is still unauthenticated until Phase 2, and
 * POST /api/insert-image accepts up to 50MB per request straight into a paid
 * Cloudinary account (AB-09). This caps the damage rate in the meantime. It is
 * NOT a substitute for authentication.
 */
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many requests. Please slow down.'),
});

module.exports = { loginLimiter, writeLimiter };
