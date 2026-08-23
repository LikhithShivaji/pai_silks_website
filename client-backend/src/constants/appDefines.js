module.exports = {
    SESSION_STATES: {
        SESSION_ACTIVE: 'ACTIVE',
        SESSION_LOGOUT: 'LOGOUT'
    },
    expiryTime: {
        // Customer sessions last 7 days (user decision, 2026-08-24).
        //
        // The JWT lifetime EQUALS the session lifetime — there is no separate
        // short-lived token. Revocation comes from the `session` table instead:
        // authMiddleware checks the row is still ACTIVE on every request, which
        // makes logout and device eviction take effect immediately. A short JWT
        // plus refresh tokens would leave an evicted device working until the
        // token aged out. See CLAUDE.md 2.-1.
        sessionExpiryTime: 1000 * 60 * 60 * 24 * 7, // 7 days

        // Retained only for the legacy renewal path in customerAuthManager.
        // Nothing should depend on it once Phase 2 Slice 4 lands.
        tokenExpiryTime: 1000 * 60 * 60 // 1 hour
    },

    // Maximum concurrent logged-in devices per customer (user decision).
    // A 3rd login evicts the OLDEST active session rather than being rejected —
    // rejecting would strand a customer who cleared cookies with no way back in.
    MAX_ACTIVE_SESSIONS: 2,

    password: {
        // bcrypt work factor for NEW hashes. Was 10.
        //
        // Raising this does NOT break existing logins: bcrypt stores the cost
        // inside the hash string ($2b$10$...), so verification uses whatever
        // each hash was created with. Only newly-set passwords use 12.
        BCRYPT_COST: 12,

        MIN_LENGTH: 8,

        // bcrypt SILENTLY TRUNCATES at 72 bytes — it does not error. Without
        // this cap a 500-character password is really only its first 72, so a
        // user would believe they had far more security than they do. Rejecting
        // is honest; silently ignoring the remainder is not. See CB-28.
        //
        // Bytes, not characters: a multi-byte character can consume up to 4.
        MAX_BYTES: 72,
    },

    // Flat shipping fee in rupees, added to every order.
    //
    // THIS IS THE SOURCE OF TRUTH for what the customer is charged. The
    // storefront shows a matching figure for display only — if the two ever
    // disagree, this value is what actually gets billed.
    //
    // Previously a 99 fee existed solely in the checkout JSX and was never
    // sent or computed server-side, so every order was recorded 99 short.
    // See CLAUDE.md CF-03.
    SHIPPING_FEE: 100
};
