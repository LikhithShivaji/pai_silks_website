const crypto = require('crypto');

class Utils {

    sendResponse(res, data = null, message = 'Success', status = 200) {
        return res.status(status).json({
            success: true,
            data,
            message
        });
    }

    sendError(res, error, status = 500) {
        return res.status(status).json({
            success: false,
            message: error.message || error
        });
    }
    
    handleMissingParams(res, msg) {
        return res.status(400).json({ error: msg });
    }

    handleInternalError(res, msg) {
        return res.status(500).json({ error: msg });
    }

    handleError(res, code, msg) {
        return res.status(code).json({ error: msg });
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

