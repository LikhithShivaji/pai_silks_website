const rateLimit = require('express-rate-limit');

/**
 * Rate limiters for the authentication endpoints.
 *
 * Neither login nor signup was throttled at all — a script could attempt
 * unlimited passwords per second. With bcrypt at cost 10 each attempt also
 * burns ~80-100ms of the single Node thread, so an unthrottled login endpoint
 * doubles as a cheap CPU-exhaustion DoS. See CLAUDE.md CB-11.
 *
 * IMPORTANT — on Render the app runs behind a reverse proxy, so req.ip is the
 * proxy's address unless `trust proxy` is set (done in server.js). Without it
 * every request appears to come from one IP and the limiter would throttle all
 * users collectively rather than per-client.
 */

const jsonMessage = (message) => ({ success: false, message });

/**
 * Login. `skipSuccessfulRequests` means only FAILED attempts count, so a
 * legitimate user logging in repeatedly is never locked out, while password
 * guessing is.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // failed attempts per IP per window
  skipSuccessfulRequests: true,
  standardHeaders: true,    // RateLimit-* response headers
  legacyHeaders: false,
  message: jsonMessage(
    'Too many login attempts. Please try again in 15 minutes.'
  ),
});

/**
 * Signup. Counts every request, successful or not — the thing being limited
 * here is bulk account creation, not guessing.
 */
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage(
    'Too many signup attempts. Please try again in 15 minutes.'
  ),
});

module.exports = { loginLimiter, signupLimiter };
