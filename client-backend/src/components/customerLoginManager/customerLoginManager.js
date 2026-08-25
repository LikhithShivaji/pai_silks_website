// customerLoginManager.js
const dbCmds = require('../../dbOps/customerDbOps');
const utils = require('../../utils/utils');
const appDefines = require('../../constants/appDefines');
const { sanitizeError } = require('../../utils/safeError');

async function loginCustomerUser(userData) {
  try {
    // Enforce the concurrent-device cap BEFORE creating the new session.
    //
    // Policy (user decision, 2026-08-24): 2 devices. A 3rd login evicts the
    // OLDEST active session rather than being rejected — rejecting would
    // strand a customer who cleared cookies or switched browser with no way
    // back in until something expired.
    //
    // Previously there was no cap and no real handling at all: the code only
    // ever looked at the single most recent session, so a second device
    // silently invalidated the first and was itself issued no cookies.
    // See CLAUDE.md CB-30 and section 2.-1.
    const maxAgeSeconds = Math.floor(
      appDefines.expiryTime.sessionExpiryTime / 1000
    );

    const active = await dbCmds.getActiveSessionsForUser(
      userData.user_id,
      appDefines.SESSION_STATES.SESSION_ACTIVE,
      maxAgeSeconds
    );

    // Oldest first, so evict from the front until there is room for one more.
    const overBy = active.length - (appDefines.MAX_ACTIVE_SESSIONS - 1);
    for (let i = 0; i < overBy; i++) {
      await dbCmds.logoutSessionBySessionId(
        active[i].session_id,
        userData.user_id,
        appDefines.SESSION_STATES.SESSION_LOGOUT
      );
    }

    // Create new session_id & token.
    //
    // The token is now a signed JWT carrying { user_id, role_id, session_id }
    // rather than sha256(user_id + Date.now()). See CLAUDE.md CB-24.
    const session_id = utils.createSessionId();
    const login_token = utils.signToken({
      user_id: userData.user_id,
      role_id: userData.role_id,
      session_id,
    });

    // Insert new session
    const sid = await dbCmds.insertNewCustomerSession(
      userData.user_id,
      userData.pri_email,
      session_id,
      login_token,
      appDefines.SESSION_STATES.SESSION_ACTIVE
    );

    return {
      pri_email: userData.pri_email,
      sid,
      success: true,
      session_id,
      token: login_token,
      user_status_id: userData.user_status_id,
      lang_id: userData.lang_id,
      role_id: userData.role_id,
    };
  } catch (error) {
    // `appConstants` was referenced here but never imported, so this catch
    // block threw ReferenceError and destroyed the original error.
    // See CLAUDE.md CB-14.
    error.httpCode = error.httpCode || 500;
    throw error;
  }
}

// customerManager.js
const getUserProfile = async (user_id) => {
  try {
    return await dbCmds.getUserById(user_id);
  } catch (err) {
    console.error("Error in getUserProfile manager:", sanitizeError(err));
    throw err;
  }
};

module.exports = {
  loginCustomerUser,
  getUserProfile
};
