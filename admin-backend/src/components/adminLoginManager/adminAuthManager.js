const dbCmds = require('../../dbOps/adminDbOps');

/**
 * Verify credentials. Nothing more.
 *
 * The previous version also tried to manage sessions, and got it wrong in four
 * ways:
 *
 *   1. It looked at only the single most-recent session, so a second device
 *      silently invalidated the first (AB-12).
 *   2. On the "valid session" branch the controller returned
 *      `{ validSession: true }` and set NO session_id cookie — the client was
 *      told it succeeded while receiving nothing to authenticate with (AB-28).
 *   3. It read `lastSession.token_created_time`, a column that does not exist,
 *      so the token-age check was always NaN and never fired (AB-41).
 *   4. It ignored `master_user.is_delete`, so a soft-deleted admin could still
 *      log in.
 *
 * Session lifecycle now lives in one place — loginAdminUser — which applies the
 * 2-device cap and always issues a fresh session.
 *
 * Note this function does NOT check role_id. Authentication answers "who are
 * you"; authorization is requireAdmin's job, and it reads the role from the
 * database row on every request rather than trusting anything issued here.
 */
const validateAdminLogin = async (pri_email, passwd) => {
  const userData = await dbCmds.verifyAdminPasswd(pri_email, passwd);

  if (!userData) {
    return { success: false, userData: null };
  }

  if (userData.is_delete) {
    return { success: false, userData: null };
  }

  return { success: true, userData };
};

module.exports = {
  validateAdminLogin,
};
