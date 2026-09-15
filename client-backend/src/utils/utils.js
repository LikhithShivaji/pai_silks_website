const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const appDefines = require('../constants/appDefines');

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
     * ONE response shape for errors: { success, message }. Mirrors the admin
     * backend's utils — see the fuller note there. See CLAUDE.md AB-35.
     *
     * These returned `{ error: msg }` while every other response in this service
     * returns `{ success, message }`, so the storefront — which reads
     * `body?.message` — got `undefined` and fell back to a generic message,
     * discarding the specific reason the server had sent. Verified before
     * changing: nothing in either frontend reads `body.error`.
     *
     * `localeKey` is accepted and echoed rather than dropped;
     * `customerController.js:93` already passes one to what was a
     * two-parameter function.
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
     * sent on cross-site requests. See CLAUDE.md CB-08.
     *
     * sameSite 'none' in production is forced by the current topology: the
     * storefront (paisilks.com) and this API (*.onrender.com) are different
     * registrable domains, so every production request is cross-site. 'lax' or
     * 'strict' would mean the browser never sends these cookies and auth
     * silently fails — and it would still pass local testing, because
     * localhost:9033 -> localhost:9034 is same-site.
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
     * IDENTICAL token. See CLAUDE.md CB-24.
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
    verifyToken(token) {
        if (!token) return null;
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch {
            return null;
        }
    }

    /**
     * @deprecated Superseded by signToken(). Retained only so the legacy
     * renewal path in customerAuthManager keeps working until Slice 4 replaces
     * it. Do not use in new code — see the entropy problem described above.
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
     * under the Date ceiling, so nothing ever threw. See CLAUDE.md CB-05.
     */
    convertDaysToMsec(nDays) {
        return nDays * (24 * 60 * 60 * 1000);
    }

    convertHoursToMsec(hours) {
        return hours * 60 * 60 * 1000;
    }
}

module.exports = new Utils();

