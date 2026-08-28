// customerLoginManager.js
const dbCmds = require('../../dbOps/customerDbOps');
const utils = require('../../utils/utils');
const appDefines = require('../../constants/appDefines');
const { sanitizeError } = require('../../utils/safeError');
const { withTransaction } = require('../../dbOps/withTransaction');

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

    // Count, evict and insert must be ONE atomic unit.
    //
    // Without the lock this is a check-then-act race: concurrent logins all
    // read the same session count, all conclude there is room, and all insert.
    // Demonstrated on the admin side before the fix — SIX simultaneous logins
    // produced FOUR active sessions against a cap of two. See CLAUDE.md AB-15.
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

      // Created inside the same transaction, so the count above and this
      // insert cannot be separated by another login.
      //
      // The token is a signed JWT carrying { user_id, role_id, session_id }
      // rather than sha256(user_id + Date.now()). See CLAUDE.md CB-24.
      const session_id = utils.createSessionId();
      const login_token = utils.signToken({
        user_id: userData.user_id,
        role_id: userData.role_id,
        session_id,
      });

      const sid = await dbCmds.insertNewCustomerSession(
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
        role_id: userData.role_id,
      };
    });
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

// Backs PUT /api/update-profile. The three fields are named explicitly here as
// well as in the SQL — the controller picks them out of the request body, so
// nothing the client sends can widen this set. See CLAUDE.md CF-06.
//
// Throws a 404-tagged error rather than returning a bare 0, so the caller
// cannot accidentally treat "no such user" as success. That was AB-13 on the
// admin side: a guard existed but its result was never read.
const updateUserProfile = async (user_id, fields) => {
  try {
    const affected = await dbCmds.updateUserProfile(user_id, fields);

    if (affected === 0) {
      const err = new Error('Profile not found.');
      err.statusCode = 404;
      throw err;
    }

    return await dbCmds.getUserById(user_id);
  } catch (err) {
    console.error("Error in updateUserProfile manager:", sanitizeError(err));
    throw err;
  }
};

module.exports = {
  loginCustomerUser,
  getUserProfile,
  updateUserProfile
};
