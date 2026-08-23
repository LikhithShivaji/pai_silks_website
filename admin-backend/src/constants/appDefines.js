module.exports = {
    SESSION_STATES: {
        SESSION_ACTIVE: 'ACTIVE',
        SESSION_LOGOUT: 'LOGOUT'
    },
    expiryTime: {
        // Admin sessions last 1 day (user decision, 2026-08-24) — deliberately
        // shorter than the customer's 7 days, because this session can delete
        // products and read every customer's address.
        //
        // The JWT lifetime EQUALS the session lifetime — there is no separate
        // short-lived token. Revocation comes from the `session` table instead:
        // authMiddleware checks the row is still ACTIVE on every request, which
        // makes logout and device eviction take effect immediately. A short JWT
        // plus refresh tokens would leave an evicted device working until the
        // token aged out. See CLAUDE.md 2.-1.
        sessionExpiryTime: 1000 * 60 * 60 * 24, // 1 day

        // Retained only for the legacy renewal path in adminAuthManager.
        // Nothing should depend on it once Phase 2 Slice 5 lands.
        tokenExpiryTime: 1000 * 60 * 60 // 1 hour
    },

    // Maximum concurrent logged-in devices for the admin account (user
    // decision). A 3rd login evicts the OLDEST active session.
    MAX_ACTIVE_SESSIONS: 2
};
