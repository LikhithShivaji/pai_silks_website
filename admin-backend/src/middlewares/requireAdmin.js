const ADMIN_ROLE_ID = 0;

/**
 * Authorization middleware. MUST run after authMiddleware, which is what sets
 * req.user.
 *
 * Before Phase 2 no role check existed anywhere. `role_id` appeared only in
 * three places — the cookie key constant, the login manager, and the login
 * controller — and all three were WRITES. Nothing ever read it back.
 * See CLAUDE.md AB-08.
 *
 * The role is read from req.user, which authMiddleware populates from the
 * master_user row. It is deliberately NOT read from:
 *   - the `role_id` cookie  — unsigned, so a raw HTTP request can set any value
 *   - the JWT claim         — signed, but could be stale if a role changed
 *                             mid-session
 *
 * Role IDs in this schema: 0 = admin, 2 = customer.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    // Middleware ordering bug — requireAdmin mounted without authMiddleware.
    // Fail closed and make the mistake loud rather than silently allowing.
    console.error('[authz] requireAdmin ran without authMiddleware — check route setup');
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }

  if (Number(req.user.role_id) !== ADMIN_ROLE_ID) {
    console.warn(
      `[authz] non-admin blocked: user_id=${req.user.user_id} role_id=${req.user.role_id} ${req.method} ${req.originalUrl}`
    );
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action.',
    });
  }

  return next();
};

module.exports = requireAdmin;
