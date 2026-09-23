// cookiesKey.js
//
// ⚠️ THESE NAMES MUST NOT MATCH client-backend's cookie names.
//
// Cookies are scoped by HOST, and a host does NOT include the port. So on
// localhost the admin panel (9032) and the storefront (9034) share one cookie
// jar: whichever service logged in last overwrote `token` and `session_id` for
// BOTH. The other service then received a JWT signed with the *other* service's
// secret, `jwt.verify` rejected it, and the user was silently logged out of the
// app they had not touched — logging into admin logged you out of the shop, and
// vice versa.
//
// Distinct names fix it at the root rather than papering over it, and they
// remain correct in production: after INFRA-01 the two backends become
// api.paisilks.com and admin-api.paisilks.com, which are different hosts today
// but would collide the moment anyone sets `Domain=.paisilks.com`.
const CookiesKey = {
  token: 'admin_token',
  session_id: 'admin_session_id',
  role_id: 'admin_role_id',
  pri_email: 'admin_pri_email',
};

// Cookie names this service used BEFORE the rename above. Logout clears these
// too, so an admin who still carries a stale `token` from the shared-name era
// does not keep sending it to the storefront on every request.
const LegacyCookieKeys = ['token', 'session_id', 'role_id', 'pri_email'];

module.exports = CookiesKey;
module.exports.LegacyCookieKeys = LegacyCookieKeys;
