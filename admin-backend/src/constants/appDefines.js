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
        'Delivered',

        // --- Terminal states other than a successful delivery -------------
        // Added 2026-09-07 because the published Refund & Cancellation Policy
        // commits the shop to two outcomes the system could not previously
        // record at all:
        //
        //   'Cancelled' — the shop cannot fulfil the order. The policy's
        //     out-of-stock clause promises a full refund including shipping,
        //     and there was no state to put such an order into.
        //   'Refunded'  — money has gone back to the customer, whether after
        //     an accepted damage claim or an unfulfillable order.
        //
        // 'Returned' was deliberately NOT added: under the policy a damage
        // return always ends in a refund, so it would be a state every order
        // passes straight through. Fewer states, fewer places to disagree.
        'Cancelled',
        'Refunded'
    ],

    /**
     * Dashboard groupings, derived from ORDER_STATUSES above.
     *
     * These exist because the dashboard had THREE disagreeing vocabularies:
     *   - this enum (the database truth)
     *   - getOrderStats, which counted SUM(status = 'Active') — and 'Active'
     *     is not a status this system has ever written, so the admin's
     *     "active orders" card read 0 permanently
     *   - DashBoard.jsx, which counted ['pending','processing','shipped']
     *
     * Between them, Confirmed / Packed / Out for Delivery were counted NOWHERE:
     * an order in any of those three states appeared in neither the active nor
     * the completed card. Verified against one order in each of the six states.
     * See CLAUDE.md AB-17.
     *
     * ACTIVE is defined as "every status except the terminal one" rather than
     * as its own hand-written list. Add a seventh status to ORDER_STATUSES and
     * it is counted automatically — which is exactly the failure being fixed
     * here, so it must not be reintroduced by listing states twice.
     */
    /**
     * bcrypt work factor, mirroring client-backend/src/constants/appDefines.js.
     *
     * The admin backend never CREATES a password — there is no admin signup —
     * but it now re-hashes on login to upgrade legacy hashes, so it needs the
     * target cost. The admin row is still `$2b$10$`, the original DB-08 shared
     * hash; it upgrades to cost 12 the next time the admin signs in.
     *
     * ⚠️ Kept in sync BY HAND with the client backend (DEP-13). If that value
     * changes, change it here too — and regenerate DUMMY_HASH in adminDbOps,
     * which must be hashed at the same cost or the AB-19e timing gap reopens.
     */
    password: {
        BCRYPT_COST: 12
    },

    /**
     * Statuses where the order is finished and needs no further action.
     *
     * ⚠️ This was the single string 'Delivered' and is now a LIST, because
     * 'Cancelled' and 'Refunded' are equally finished — an order in either is
     * not waiting on anybody. Leaving it as one value would have made both new
     * states count as ACTIVE (see the getter below, which is "everything that
     * is not terminal"), so the admin's "active orders" card would have
     * included every cancelled and refunded order forever.
     *
     * That is exactly AB-17 again: a status counted in the wrong bucket with
     * nothing to reveal it. Adding a status is therefore a TWO-part change —
     * add it to ORDER_STATUSES, then decide here whether it is terminal.
     *
     * ORDER_STATUS_DELIVERED is kept separate because "sold" is not the same
     * question as "finished": a refunded order is finished but must NOT count
     * towards best-sellers or revenue.
     */
    ORDER_STATUS_TERMINAL: ['Delivered', 'Cancelled', 'Refunded'],

    /** The one status that means the customer received and kept the goods. */
    ORDER_STATUS_DELIVERED: 'Delivered',

    /**
     * Carriers the shop despatches with. See CLAUDE.md DB-09.
     *
     * A closed list, not free text, because the storefront builds a tracking
     * URL from this value — an unrecognised carrier produces a link to nowhere.
     * `product.category` is the cautionary tale here: a free-text column that
     * drifted out of step with the table it was meant to mirror (AB-31/DB-06).
     *
     * Adding a carrier means adding it here AND adding its tracking URL to the
     * storefront's carrier config, or the value saves fine and the customer
     * gets a dead link.
     */
    CARRIERS: ['DTDC', 'India Post'],

    /**
     * Statuses that may not be set without a consignment number and carrier.
     *
     * Once an order is out of the shop's hands, the customer must be able to
     * find it. Nothing fills these fields automatically at launch — DTDC issues
     * API credentials only after go-live, and a tracking API takes the number
     * as INPUT rather than supplying it — so this requirement is what
     * guarantees a dispatched order is trackable.
     *
     * Derived from ORDER_STATUSES rather than retyped, so a typo here cannot
     * silently disable the rule. Terminal states are excluded: an order already
     * Delivered, Cancelled or Refunded is not awaiting a parcel, and a
     * cancelled order legitimately has no consignment number at all.
     */
    get STATUSES_REQUIRING_TRACKING() {
        const dispatched = ['Shipped', 'Out for Delivery'];
        return this.ORDER_STATUSES.filter((s) => dispatched.includes(s));
    },

    /**
     * Everything still in flight. Derived, never hand-listed — listing states
     * twice is what produced AB-17.
     */
    get ORDER_STATUS_ACTIVE() {
        return this.ORDER_STATUSES.filter(
            (s) => !this.ORDER_STATUS_TERMINAL.includes(s)
        );
    },

    // Dashboard list caps. Both queries were named "best sellers" and "recent
    // orders" and had no LIMIT at all — they returned the entire delivered
    // catalogue and every order ever placed. See CLAUDE.md AB-17 (b)(c).
    DASHBOARD_LIMITS: {
        BEST_SELLERS: 10,
        RECENT_ORDERS: 10
    }
};
