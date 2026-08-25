const dbCmds = require('../../dbOps/adminDbOps');
const utils = require('../../utils/utils');
const appDefines = require('../../constants/appDefines');
const { withTransaction } = require('../../dbOps/withTransaction');

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

    // Count, evict and insert must be ONE atomic unit.
    //
    // Without the lock this is a check-then-act race: concurrent logins all
    // read the same session count, all conclude there is room, and all insert.
    // Verified empirically before the fix — SIX simultaneous logins produced
    // FOUR active sessions against a cap of two. See CLAUDE.md AB-15.
    //
    // The lock is on the master_user row, not on the session rows: locking
    // `session` would lock only rows that already match, so a user with zero
    // active sessions would have nothing locked and the race would survive.
    return withTransaction(async (conn) => {
      await dbCmds.lockUserForSessionUpdate(userData.user_id, conn);

      const active = await dbCmds.getActiveSessionsForUser(
        userData.user_id,
        appDefines.SESSION_STATES.SESSION_ACTIVE,
        maxAgeSeconds,
        conn
      );

      // Oldest first, so evict from the front until there is room for one more.
      const overBy = active.length - (appDefines.MAX_ACTIVE_SESSIONS - 1);
      for (let i = 0; i < overBy; i++) {
        await dbCmds.logoutSessionBySessionId(
          active[i].session_id,
          userData.user_id,
          appDefines.SESSION_STATES.SESSION_LOGOUT,
          conn
        );
      }

      // Create the new session inside the same transaction, so the count
      // above and this insert cannot be separated by another login.
      //
      // The token is a signed JWT carrying { user_id, role_id, session_id }
      // rather than sha256(user_id + Date.now()). See CLAUDE.md AB-24.
      const session_id = utils.createSessionId();
      const login_token = utils.signToken({
        user_id: userData.user_id,
        role_id: userData.role_id,
        session_id,
      });

      const sid = await dbCmds.insertNewSession(
        userData.user_id,
        userData.pri_email,
        session_id,
        login_token,
        appDefines.SESSION_STATES.SESSION_ACTIVE,
        conn
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
    });
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