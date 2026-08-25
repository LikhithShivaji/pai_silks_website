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
    MAX_ACTIVE_SESSIONS: 2,

    /**
     * Order fulfilment states, in order (owner decision, 2026-08-24).
     *
     * Strictly forward-only. There is deliberately NO Cancelled and NO
     * Returned: the business does not accept returns or cancellations, so
     * those states would have no meaning. Raised and declined explicitly.
     *
     * Previously `status` was written straight from the request body with no
     * check at all, so "delivered" (lowercase) or "Shipped!" would persist —
     * and silently break the dashboard, which compares
     * `SUM(status = 'Delivered')` on an exact string. See CLAUDE.md AB-13.
     *
     * The admin ships via DTDC and India Post. When a carrier API is wired up,
     * the last three states will be driven by carrier events. Carrier APIs
     * return their own vocabulary, so that integration needs a MAPPING layer —
     * do not write carrier strings straight into this column.
     */
    ORDER_STATUSES: [
        'Pending',
        'Confirmed',
        'Packed',
        'Shipped',
        'Out for Delivery',
        'Delivered'
    ]
};
