const utils = require('../utils/utils');
const dbCmds = require('../dbOps/adminDbOps');
const appDefines = require('../constants/appDefines');
const CookiesKey = require('../constants/cookieKeys');

/**
 * Authentication middleware.
 *
 * This file was previously EMPTY (0 bytes) and referenced nowhere, so all 15
 * admin routes were fully anonymous. `curl -X DELETE .../api/delete-product/1`
 * worked from anywhere, and GET /api/get-order-detils dumped every customer's
 * name, shipping address and payment status to any caller. See CLAUDE.md
 * AB-01, AB-02.
 *
 * Three checks, cheapest first:
 *
 *   1. jwt.verify()          signature + expiry, no DB hit
 *   2. session row ACTIVE    enables INSTANT revocation (logout, device
 *                            eviction). A stateless JWT alone cannot do this.
 *   3. is_delete = 0         a soft-deleted account cannot authenticate
 *
 * On success attaches:
 *   req.user = { user_id, role_id, session_id, sid, pri_email }
 *
 * role_id comes from the DATABASE row, never from the JWT claim or the
 * `role_id` cookie — that cookie is unsigned and therefore forgeable (AB-08).
 * requireAdmin reads req.user.role_id, so this distinction is what makes the
 * role check trustworthy.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.[CookiesKey.token];

    const payload = utils.verifyToken(token);
    if (!payload) {
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

    if (session.is_delete) {
      return res.status(403).json({
        success: false,
        message: 'This account is no longer active.',
      });
    }

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
    };

    return next();
  } catch (err) {
    return next(err); // handled by the global error handler in server.js
  }
};

module.exports = authMiddleware;
