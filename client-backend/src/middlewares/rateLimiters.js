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
/**
 * Signup limiter — deliberately tight, because this endpoint is an
 * account-existence oracle.
 *
 * Signup answers 409 for an email that already exists and 201 for one that does
 * not (verified). That is a direct yes/no on whether this shop has an account
 * for any address someone cares to test, and it cannot be closed by making the
 * responses uniform: doing so would mean telling an honest customer who
 * mistyped nothing useful, AND promising "check your inbox" when there is no
 * mail channel to send anything through. See CLAUDE.md CB-27.
 *
 * So the response stays honest and the RATE is what makes bulk probing
 * impractical: 5 per hour instead of 10 per 15 minutes — from 40/hour down to
 * 5/hour, an 8x reduction in how fast a list can be tested.
 *
 * A real shop signs up a handful of customers a day from any one IP, so this
 * does not constrain legitimate use. Shared IPs (a college, an office, a mobile
 * carrier NAT) are the edge case; 5/hour still clears that comfortably.
 *
 * The proper fix arrives with WhatsApp OTP (see Deferred work): once there IS a
 * channel, identical responses become true rather than a lie, and the account's
 * real owner gets told someone probed it.
 */
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage(
    'Too many signup attempts from this network. Please try again later.'
  ),
});

module.exports = { loginLimiter, signupLimiter };
