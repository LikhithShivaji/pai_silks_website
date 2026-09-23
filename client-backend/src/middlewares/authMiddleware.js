const utils = require('../utils/utils');
const dbCmds = require('../dbOps/customerDbOps');
const appDefines = require('../constants/appDefines');
const CookiesKey = require('../constants/cookieKeys');

/**
 * Authentication middleware.
 *
 * This file was previously EMPTY (0 bytes) and `app.use(authMiddleware)` was
 * commented out in server.js, so all 23 routes were fully anonymous. Anyone
 * could read or modify any customer's cart, wishlist, orders and profile by
 * passing a different user_id. See CLAUDE.md CB-01, CB-02.
 *
 * Three checks, in order — cheapest first:
 *
 *   1. jwt.verify()          signature + expiry, no DB hit
 *   2. session row ACTIVE    enables INSTANT revocation (logout, device
 *                            eviction). A stateless JWT alone cannot do this.
 *   3. is_delete = 0         a soft-deleted account cannot authenticate (CB-21)
 *
 * On success attaches:
 *   req.user = { user_id, role_id, session_id, sid, pri_email }
 *
 * Handlers MUST take identity from req.user and never from the request body,
 * params or query. Note the role_id here comes from the DATABASE row, not from
 * the JWT claim — the claim could be stale if a role changed mid-session, and
 * the `role_id` cookie is unsigned and therefore forgeable (CB-09).
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.[CookiesKey.token];

    const payload = utils.verifyToken(token);
    if (!payload) {
      // Diagnostics first. A bare 401 with no log is what made the
      // cross-service logout impossible to diagnose: the server looked healthy
      // while every request failed.
      //
      // The cookie NAMES are listed because the failure is usually about which
      // cookie arrived, not what was in it. Names only — never values: these
      // are session tokens, and logging one would put a live credential in a
      // log file.
      const names = Object.keys(req.cookies || {});
      console.warn(
        `[auth] 401 on ${req.method} ${req.originalUrl}\n` +
        `       cookies received: ${names.length ? names.join(', ') : '(none)'}\n` +
        `       expected token cookie: ${CookiesKey.token}\n` +
        `       reason: ${utils.describeTokenFailure(token)}`
      );

      // A token THIS service cannot verify is useless to it — and if it is left
      // in the browser it is re-sent on every single request, failing
      // identically, until it expires days later.
      //
      // That is exactly what kept the storefront logged out after the admin
      // cookies were renamed: the browser still held a `token` cookie holding
      // an ADMIN JWT from before the rename. Nothing overwrote it (admin now
      // writes `admin_token`) and nothing cleared it, so it poisoned every
      // storefront request indefinitely. Clearing it here makes that
      // self-healing for every user instead of requiring them to clear their
      // browser data by hand.
      //
      // Safe for the ordinary expired-session case too: the cookie is spent,
      // and the user is being sent to log in again regardless.
      if (token) utils.clearAuthCookies(res);

      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    const maxAgeSeconds = Math.floor(
      appDefines.expiryTime.sessionExpiryTime / 1000
    );

    const session = await dbCmds.getActiveSessionById(
      payload.session_id,
      appDefines.SESSION_STATES.SESSION_ACTIVE,
      maxAgeSeconds
    );

    // Missing, logged out, evicted by the device cap, or aged out.
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Your session has ended. Please log in again.',
      });
    }

    // Soft-deleted accounts must not authenticate. CB-21.
    if (session.is_delete) {
      return res.status(403).json({
        success: false,
        message: 'This account is no longer active.',
      });
    }

    // A valid token whose session belongs to a different user means the token
    // was tampered with or replayed. Should be impossible given the signature,
    // but the cost of checking is nil and the cost of being wrong is total.
    if (Number(session.user_id) !== Number(payload.user_id)) {
      console.warn(
        `[auth] token/session user mismatch: token=${payload.user_id} session=${session.user_id}`
      );
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    req.user = {
      user_id: session.user_id,
      role_id: session.role_id,   // from the DB row, not the JWT claim
      session_id: session.session_id,
      sid: session.sid,
      pri_email: session.pri_email,
      // Display name, from the master_user row joined in the session query.
      // Carried so /api/verify-token can return it and the storefront can greet
      // the customer from the SERVER's answer instead of an editable
      // localStorage string. See CLAUDE.md CF-46.
      user_name: session.user_name,
      // Account phone, for prefilling the checkout delivery number.
      phone_number: session.phone_number,
    };

    return next();
  } catch (err) {
    return next(err); // handled by the global error handler in server.js
  }
};

module.exports = authMiddleware;
