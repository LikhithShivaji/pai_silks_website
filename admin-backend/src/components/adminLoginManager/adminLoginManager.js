const dbCmds = require('../../dbOps/adminDbOps');
const utils = require('../../utils/utils');
const appDefines = require('../../constants/appDefines');

// adminLoginManager.js
async function loginAdminUser(userData) {
  try {
    // Enforce the concurrent-device cap BEFORE creating the new session.
    //
    // Policy (user decision, 2026-08-24): 2 devices, 1-day sessions. A 3rd
    // login evicts the OLDEST active session rather than being rejected.
    //
    // For the admin account this doubles as a crude intrusion limit: if
    // someone else is using the credentials, the legitimate admin's third
    // login pushes the oldest session out. See CLAUDE.md AB-12 and 2.-1.
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
    // rather than sha256(user_id + Date.now()). See CLAUDE.md AB-24.
    const session_id = utils.createSessionId();
    const login_token = utils.signToken({
      user_id: userData.user_id,
      role_id: userData.role_id,
      session_id,
    });

    // Insert new session
    const sid = await dbCmds.insertNewSession(
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
      role_id: userData.role_id
    };
  } catch (error) {
    // `appConstants` was referenced here but never imported, so this catch
    // block threw ReferenceError and destroyed the original error.
    // See CLAUDE.md AB-12.
    error.httpCode = error.httpCode || 500;
    throw error;
  }
}

module.exports = {
  loginAdminUser,
  // other exported functions go here
};