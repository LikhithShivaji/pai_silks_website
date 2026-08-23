// customerAuthManager.js
const dbCmds = require('../../dbOps/customerDbOps');

/**
 * Verify credentials. Nothing more.
 *
 * The previous version also tried to manage sessions, and got it wrong in
 * three ways:
 *
 *   1. It looked at only the single most-recent session (`ORDER BY
 *      login_date_time DESC LIMIT 1`), so a second device silently invalidated
 *      the first — and on the "valid session" branch the controller set NO
 *      cookies at all while returning "Login successful" (CB-30).
 *   2. It read `lastSession.token_created_time`, a column that does not exist,
 *      so the token-age check was always NaN and never fired (AB-41).
 *   3. It ignored `master_user.is_delete` entirely, so a soft-deleted account
 *      could still log in (CB-21).
 *
 * Session lifecycle now lives in one place — loginCustomerUser — which applies
 * the 2-device cap and always issues a fresh session. Splitting "who are you"
 * from "what session do you get" is what makes the device policy expressible.
 */
const validateCustomerLogin = async (pri_email, passwd) => {
  const userData = await dbCmds.verifyCustomerPasswd(pri_email, passwd);

  if (!userData) {
    return { success: false, userData: null };
  }

  // A soft-deleted account must not authenticate. Login never checked this.
  // See CLAUDE.md CB-21.
  if (userData.is_delete) {
    return { success: false, userData: null };
  }

  return { success: true, userData };
};

module.exports = {
  validateCustomerLogin,
};
