module.exports = {
    SESSION_STATES: {
        SESSION_ACTIVE: 'ACTIVE',
        SESSION_LOGOUT: 'LOGOUT'
    },
    expiryTime: {
        sessionExpiryTime: 1000 * 60 * 60 * 24, // 1 day
        tokenExpiryTime: 1000 * 60 * 60 // 1 hour
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
