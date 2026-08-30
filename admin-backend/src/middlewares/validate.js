/**
 * Re-export of the shared validation middleware.
 *
 * The implementation lives in `shared/validate.js` — one copy, used by both
 * services. This file keeps the import path (`middlewares/validate`) unchanged
 * for the routers that require it.
 *
 * Nothing here is service-specific and nothing should be added: the RULES live
 * in `middlewares/validators.js`, which is where the two services legitimately
 * differ. See CLAUDE.md DEP-13.
 */
module.exports = require('../../../shared/validate');
