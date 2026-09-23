// Loaded FIRST and explicitly. Keep this above every local require: anything
// that reads process.env at module scope (config/db.js does) must not be
// loaded before this line, or it sees an empty environment.
require("dotenv").config();

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const adminRoutes = require('./routes/adminRoutes');
const controllers = require('./controllers/adminController')
const cors = require('cors');

const { loginLimiter, writeLimiter } = require('./middlewares/rateLimiters');
const { sanitizeError } = require('./utils/safeError');
// Imported so the graceful-shutdown handler below can drain it. This is the
// same singleton pool every dbOps module uses — requiring it here does not
// create a second one.
const pool = require('./config/db');

const app = express();

// Render terminates TLS at a reverse proxy, so req.ip is the proxy's address
// unless this is set. Without it the rate limiters would see every request as
// coming from one IP and throttle all users collectively. Only trusted in
// production — enabling it locally would let a client spoof X-Forwarded-For.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers. Sets X-Content-Type-Options, X-Frame-Options, HSTS,
// Referrer-Policy and friends. See CLAUDE.md AB-19.
app.use(helmet());

// Stop advertising the stack to anyone who looks at a response header.
app.disable('x-powered-by');

// --- CORS -------------------------------------------------------------
// Previously `origin: true`, which reflects back whatever Origin the caller
// sends — i.e. every website on the internet was allowed, with credentials.
// See CLAUDE.md AB-02.
//
// Both frontends call this service: the admin panel for everything, and the
// storefront for the product catalogue (CF-22, to be re-pointed in Phase 5).
//
// Set CORS_ORIGINS in the Render dashboard for production, as a
// comma-separated list. The defaults below cover local development only.
//
// NOTE: CORS is a BROWSER mechanism. It stops other websites calling this API
// from a victim's browser; it does NOT stop curl or Postman. Only real
// authentication does that — Phase 2.
const allowedOrigins = (
  process.env.CORS_ORIGINS || 'http://localhost:9031,http://localhost:9033'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: curl, server-to-server, health checks. Not a
      // browser cross-origin request, so there is nothing for CORS to guard.
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Omit the CORS headers rather than throwing. The browser then blocks
      // the response itself; throwing here would surface as a confusing 500.
      console.warn(`[cors] blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true, // required for the cookie-based sessions added in Phase 2
    // Response headers a cross-origin caller is allowed to READ.
    //
    // Without this the browser hides them: the headers arrive on the wire, and
    // `res.headers.get('ratelimit-reset')` still returns null. The rate-limit
    // page would then say "try again in an hour" no matter how little time was
    // actually left — a silent degradation with no error anywhere, which is the
    // kind that survives testing.
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
  })
);

app.use(express.json());

// Form-encoded bodies. Without this, a request sent as
// application/x-www-form-urlencoded — the default for a plain HTML <form>, and
// what most API clients fall back to — arrives with `req.body` undefined rather
// than parsed. The validators then report every field as missing, producing a
// 400 that blames the caller for a body the server never read. The 100kb limit
// mirrors express.json's default rather than leaving it unbounded.
//
// Note this does NOT affect /api/insert-image: multipart/form-data is parsed by
// multer, which is mounted on that route separately.
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use(cookieParser());

// --- Health check --------------------------------------------------------
// Mounted at /health, deliberately NOT under /api: writeLimiter is applied to
// everything under /api, and a platform polling its health check every few
// seconds would eventually throttle itself and report the service as down.
//
// Reports readiness, not just liveness. A process that is running but cannot
// reach MySQL can serve nothing useful, so answering 200 in that state would
// tell Render to keep routing traffic to a service that 500s every request.
//
// The response body is deliberately minimal — this endpoint is unauthenticated,
// so it must never leak the database name, host, versions or error text. The
// reason for a failure goes to the logs, not to the caller.
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ status: 'ok', db: 'up' });
  } catch (err) {
    console.error('[health] database unreachable:', err.code || err.message);
    return res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

// Brute-force protection: 5 FAILED attempts per IP per 15 min. See AB-03.
app.post('/api/admin-login', loginLimiter, controllers.adminLogin);

// Blanket cap on the rest. Every route below is still unauthenticated until
// Phase 2, and /api/insert-image accepts 50MB per request into a paid
// Cloudinary account (AB-09) — this limits the damage rate. It is not a
// substitute for authentication.
app.use('/api', writeLimiter, adminRoutes); // Prefix routes with /api

// --- 404: unmatched routes ---------------------------------------------
// Without this Express falls through to its built-in handler, which returns
// an HTML error page from a JSON API.
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

// --- Global error handler ----------------------------------------------
// Must be last, and must take four arguments or Express will not treat it as
// an error handler.
//
// Previously there was none, so Express's default handler ran — and because
// NODE_ENV was never set it ran in development mode, returning FULL STACK
// TRACES to the client. mysql2 errors also carry the failing SQL and its bound
// parameters, i.e. customer data. See CLAUDE.md AB-18.
//
// The stack is logged server-side and never sent to the client.
app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.originalUrl}`, sanitizeError(err));

  if (res.headersSent) return next(err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: 'Something went wrong. Please try again.'
  });
});

// --- Listen -------------------------------------------------------------
// The port MUST come from the environment. Render assigns a port at runtime,
// publishes it as PORT, and routes traffic only there — a hardcoded 9032 binds
// somewhere the platform is not listening, so the health check never passes and
// the deploy is marked failed with the service apparently "running fine" in its
// own logs. The literal is the local development default only.
// See CLAUDE.md AB-37.
// `??` rather than `||`. PORT=0 is a legitimate, meaningful value — it asks the
// OS for any free port, which is how CI and test harnesses start a server
// without picking one. `Number(process.env.PORT) || 9032` treated that 0 as
// "unset" and silently bound 9032 instead, so a caller asking for an ephemeral
// port got a fixed one and a port clash looked like the setting being ignored.
const PORT = Number(process.env.PORT ?? 9032);

// Logs the port actually BOUND, read back from the server, rather than the one
// requested. With PORT=0 the requested value is 0 and the real port is assigned
// by the OS, so echoing the request would print a port nothing is listening on.
const server = app.listen(PORT, () => {
  // Report the port actually BOUND, and report NOTHING if the bind failed.
  //
  // `server.address()` is null when the socket is not bound. Two earlier
  // versions of this line were both wrong:
  //
  //   server.address().port          -> TypeError on any listen failure, which
  //                                     surfaced via uncaughtException as
  //                                     "Cannot read properties of null" and
  //                                     completely hid the real cause.
  //   server.address()?.port ?? PORT -> no crash, but it PRINTED
  //                                     "Server running on port 9032" for a
  //                                     server that had not started. A false
  //                                     success line is worse than none: the
  //                                     log then contradicts itself.
  //
  // Both observed against a port already in use. The error handler below is
  // what speaks when the bind fails. See CLAUDE.md AB-38.
  const address = server.address();
  if (address) console.log(`Server running on port ${address.port}`);
});

// Report why the server could not start, in words.
//
// Without this, a failed bind reaches the uncaughtException handler and is
// logged as a generic error, so the single most common startup problem — the
// port is already taken, usually by an instance left running from earlier —
// reads as an internal fault. EADDRINUSE is called out by name because it is
// both the most frequent and the most trivially fixable.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Another instance is probably still ` +
      `running — find it with \`lsof -ti tcp:${PORT}\` and stop it, or set a ` +
      `different PORT.`
    );
  } else {
    console.error(`Server failed to start: ${err.code || err.message}`);
  }
  process.exit(1);
});

// --- Graceful shutdown ---------------------------------------------------
// Render sends SIGTERM on every deploy, restart and scale event, then SIGKILLs
// after a grace period. With no handler the process dies instantly and every
// in-flight request is cut off mid-response. On this service that includes a
// product write inside withTransaction and an image upload already in flight to
// Cloudinary — the latter can leave an asset paid for and stored with no
// database row pointing at it, which is exactly the orphan class AB-10 fixed.
//
// Closing the pool matters too: without it MySQL keeps up to 10 connections per
// instance open until they time out server-side, and a redeploy loop can pile
// up connections faster than they are reclaimed.
let shuttingDown = false;

const shutdown = (signal) => {
  if (shuttingDown) return; // a second signal must not re-enter this
  shuttingDown = true;
  console.log(`[${signal}] shutting down`);

  // Stop accepting new connections; the callback fires once in-flight requests
  // have finished.
  server.close(async () => {
    try {
      await pool.end();
      console.log('HTTP server closed, database pool drained');
    } catch (err) {
      console.error('Error draining pool:', sanitizeError(err));
    }
    process.exit(0);
  });

  // Backstop: never hang forever waiting on a stuck connection. Render's grace
  // period is short, so exit on our own terms before it escalates to SIGKILL.
  // .unref() so this timer alone does not keep the process alive.
  setTimeout(() => {
    console.error('Shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C in local development

// --- Last-resort process handlers ----------------------------------------
// An unhandled rejection is a bug, not a recoverable state: the process is in
// an unknown condition, so log it and let the platform restart us cleanly
// rather than serving requests from a corrupted state. Logging via
// sanitizeError keeps SQL and bound parameters out of the logs, exactly as the
// request-level error handler above does.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', sanitizeError(reason));
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', sanitizeError(err));
  shutdown('uncaughtException');
});
