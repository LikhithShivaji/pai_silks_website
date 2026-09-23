const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const appDefines = require('../constants/appDefines');
const CookiesKey = require('../constants/cookieKeys');

/**
 * Fail fast at startup rather than signing tokens with `undefined`, which
 * jsonwebtoken would happily accept and which would make every token forgeable.
 */
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error(
        'Missing required environment variable: JWT_SECRET\n' +
        '  Generate one with:  openssl rand -hex 32\n' +
        '  Local dev:  add it to .env\n' +
        '  Production: set it in the Render dashboard (Service -> Environment)'
    );
}

class Utils {

    /**
     * `success` is DERIVED from the status code, never asserted.
     *
     * It was hardcoded `true`, so a caller passing a 4xx got
     * `{ success: true }` alongside an error status — a response contradicting
     * itself, where a client checking `body.success` concluded the opposite of
     * a client checking `res.ok`. Every current call site passes the default
     * 200, so nothing changes today; the point is that the wrong answer is no
     * longer one argument away. See CLAUDE.md AB-34.
     */
    sendResponse(res, data = null, message = 'Success', status = 200) {
        return res.status(status).json({
            success: status >= 200 && status < 400,
            data,
            message
        });
    }

    sendError(res, error, status = 500) {
        // `|| error` removed from the message. It read
        // `'Something went wrong. Please try again.' || error`, and a non-empty
        // string is always truthy, so the right-hand side was unreachable —
        // dead code that looked like a fallback. Sending the generic text is
        // correct (CB-12/AB-18: raw error messages leak SQL and bound
        // parameters), so the behaviour is unchanged; only the pretence is gone.
        // The real error is logged by the caller via sanitizeError.
        return res.status(status).json({
            success: false,
            message: 'Something went wrong. Please try again.'
        });
    }

    /**
     * ONE response shape for errors: { success, message }.
     *
     * These three returned `{ error: msg }` while every other response in both
     * services returns `{ success, message }`. The frontends read
     * `body?.message` — see AdminHomePage's status-update handler — so an error
     * from one of these arrived with `message` undefined and the UI fell back
     * to a generic "Could not update the order", discarding the specific reason
     * the server had gone to the trouble of sending. Verified before changing:
     * nothing in either frontend reads `body.error`. See CLAUDE.md AB-35.
     *
     * `localeKey` is accepted and echoed rather than ignored. Callers already
     * pass one — `adminController.js:19` and `customerController.js:93` both
     * pass a third argument to a two-parameter function, so the key was
     * silently dropped. Accepting it makes those calls honest; omitting it
     * stays valid.
     */
    handleMissingParams(res, msg, localeKey) {
        return res.status(400).json({
            success: false,
            message: msg,
            ...(localeKey ? { localeKey } : {})
        });
    }

    handleInternalError(res, msg, localeKey) {
        return res.status(500).json({
            success: false,
            message: msg,
            ...(localeKey ? { localeKey } : {})
        });
    }

    handleError(res, code, msg, localeKey) {
        return res.status(code).json({
            success: code >= 200 && code < 400,
            message: msg,
            ...(localeKey ? { localeKey } : {})
        });
    }

    /**
     * Set an auth cookie.
     *
     * @param expiryTime lifetime in MILLISECONDS. Pass the appDefines value
     *                   directly — do NOT run it through convertDaysToMsec.
     *
     * Previously set only { maxAge, httpOnly }: readable over plain HTTP and
     * sent on cross-site requests. See CLAUDE.md AB-04.
     *
     * sameSite 'none' in production is forced by the current topology: the
     * admin panel (admin.paisilks.com) and this API (*.onrender.com) are
     * different registrable domains, so every production request is
     * cross-site. 'lax' or 'strict' would mean the browser never sends these
     * cookies and auth silently fails — and it would still pass local testing,
     * because localhost:9031 -> localhost:9032 is same-site.
     *
     * CSRF protection therefore rests on the CORS allowlist (Slice 7) rather
     * than on sameSite. INFRA-01 moves the APIs to *.paisilks.com subdomains,
     * after which this MUST be changed back to 'lax'.
     */
    setCookies(res, key, value, expiryTime) {
        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie(key, value, {
            maxAge: expiryTime,
            httpOnly: true,                           // unreadable from JS
            secure: isProduction,                     // HTTPS only in production
            sameSite: isProduction ? 'none' : 'lax',  // see note above; revisit at INFRA-01
            path: '/',
        });
    }

    /**
     * Sign a session JWT.
     *
     * Replaces the previous genToken(), which was
     * `sha256(user_id + Date.now())` — both inputs guessable. user_id is a
     * small sequential integer and Date.now() is millisecond time, so a day's
     * keyspace was roughly 2^27: a GPU sweeps that in well under a second.
     * Unsalted, unkeyed, and two logins in the same millisecond produced an
     * IDENTICAL token. See CLAUDE.md AB-24.
     *
     * The session_id claim is what authMiddleware uses to find the session row,
     * so logout and device eviction take effect on the very next request.
     *
     * @param {{user_id:number, role_id:number, session_id:string}} payload
     */
    signToken({ user_id, role_id, session_id }) {
        return jwt.sign(
            { user_id, role_id, session_id },
            JWT_SECRET,
            { expiresIn: Math.floor(appDefines.expiryTime.sessionExpiryTime / 1000) }
        );
    }

    /**
     * Verify a session JWT. Returns the decoded payload, or null if the token
     * is missing, malformed, expired, or signed with a different secret.
     *
     * Never throws — callers treat null as "not authenticated".
     */
    /**
     * Remove this service's auth cookies, with the SAME attributes they were
     * set with — a mismatch on path or sameSite leaves the browser holding the
     * cookie it was told to drop.
     *
     * Also clears the LEGACY names this service used before the admin/client
     * cookie split. That is the whole point: a browser holding a stale `token`
     * from the shared-name era re-sends it on every request forever, and
     * nothing else ever removes it.
     */
    clearAuthCookies(res) {
        const isProduction = process.env.NODE_ENV === 'production';
        const opts = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
        };
        // ⚠️ ONLY this service's OWN cookie names.
        //
        // The admin's legacy names include plain `token` and `session_id` —
        // which now belong to the STOREFRONT. Clearing those from here would
        // log a customer out of the shop whenever an admin request failed, on
        // any host where the two share a cookie jar. That is the original bug
        // in reverse, and it is why the legacy list is deliberately NOT used
        // here.
        //
        // The stale shared-name cookie still gets cleaned up, by the service
        // that actually owns that name: the storefront receives the leftover
        // `token`, cannot verify it, and clears it on the first request.
        [CookiesKey.token, CookiesKey.session_id]
            .forEach((name) => res.clearCookie(name, opts));
    }

    verifyToken(token) {
        if (!token) return null;
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch {
            return null;
        }
    }

    /**
     * Why a token failed, for logging only.
     *
     * verifyToken() returns null for every failure, which is correct for the
     * auth decision — a caller must never branch on the reason — but it meant
     * the logs could not distinguish an EXPIRED session (normal, the user waits
     * a week) from an INVALID SIGNATURE (a token issued by a different service,
     * i.e. a cookie-name collision). Those two need completely different
     * responses and looked identical.
     *
     * Never send this to a client: "invalid signature" vs "expired" is exactly
     * the kind of detail that helps someone probing the API.
     */
    describeTokenFailure(token) {
        if (!token) return 'no token';
        try {
            jwt.verify(token, JWT_SECRET);
            return 'valid';
        } catch (err) {
            if (err.name === 'TokenExpiredError') return `expired at ${err.expiredAt?.toISOString?.() ?? 'unknown'}`;
            if (err.name === 'NotBeforeError') return 'not active yet';
            // 'invalid signature' is the one that matters: the token is
            // well-formed but was signed with ANOTHER secret — almost always a
            // token minted by the other service under a colliding cookie name.
            return `${err.name}: ${err.message}`;
        }
    }

    /**
     * @deprecated Superseded by signToken(). Retained only so the legacy
     * renewal path in adminAuthManager keeps working until Slice 5 replaces it.
     * Do not use in new code — see the entropy problem described above.
     */
    genToken(data) {
        return crypto.createHash('sha256').update(data + Date.now().toString()).digest('hex');
    }

    createSessionId() {
        return crypto.randomBytes(16).toString('hex');
    }

    getCurrentDTInUTC() {
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    /**
     * @deprecated Do not use for cookie expiry.
     *
     * appDefines.expiryTime.* are ALREADY in milliseconds. Calling this on one
     * of them multiplied by 86,400,000 a second time, producing a maxAge of
     * ~7.46e15 ms — cookies that expire in the year 238,581. It stayed just
     * under the Date ceiling, so nothing ever threw. See CLAUDE.md AB-05.
     */
    convertDaysToMsec(nDays) {
        return nDays * (24 * 60 * 60 * 1000);
    }

    convertHoursToMsec(hours) {
        return hours * 60 * 60 * 1000;
    }
}

module.exports = new Utils();

