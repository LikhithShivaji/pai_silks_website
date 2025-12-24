// customerLoginManager.js
const dbCmds = require('../../dbOps/customerDbOps');
const utils = require('../../utils/utils');
const appDefines = require('../../constants/appDefines');


// ---------------------- CUSTOMER SIGN UP ----------------------


async function registerCustomer(userData) {
  try {
    return await dbCmds.insertCustomerUser(userData);
  } catch (err) {
    throw err;
  }
}

module.exports = {
  registerCustomer,
};