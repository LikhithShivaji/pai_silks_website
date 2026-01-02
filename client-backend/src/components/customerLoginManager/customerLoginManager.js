// customerLoginManager.js
const dbCmds = require('../../dbOps/customerDbOps');
const utils = require('../../utils/utils');
const appDefines = require('../../constants/appDefines');

async function loginCustomerUser(userData) {
  try {
    // Create new session_id & token
    const session_id = utils.createSessionId();
    const login_token = utils.genToken(userData.user_id);

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
    error.httpCode =
      error.httpCode || appConstants.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
    throw error;
  }
}

// customerManager.js
const getUserProfile = async (user_id) => {
  try {
    return await dbCmds.getUserById(user_id);
  } catch (err) {
    console.error("Error in getUserProfile manager:", err);
    throw err;
  }
};

module.exports = {
  loginCustomerUser,
  getUserProfile
};
