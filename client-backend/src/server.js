const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const customerRoutes = require('./routes/customerRoutes');
const cors = require('cors');
const { sanitizeError } = require('./utils/safeError');
// Loaded explicitly. This previously happened only as a side effect of
// requiring config/db.js — so a change in require order would have silently
// dropped every environment variable. See CLAUDE.md CB-37.
require('dotenv').config();

const app = express();

// Render terminates TLS at a reverse proxy, so req.ip is the proxy's address
// unless this is set. Without it the rate limiters would see every request as
// coming from one IP and throttle all users collectively. Only trusted in
// production — enabling it locally would let a client spoof X-Forwarded-For.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers. Sets X-Content-Type-Options, X-Frame-Options, HSTS,
// Referrer-Policy and friends. See CLAUDE.md CB-19.
app.use(helmet());

// Stop advertising the stack to anyone who looks at a response header.
app.disable('x-powered-by');

// --- CORS -------------------------------------------------------------
// Previously `origin: true`, which reflects back whatever Origin the caller
// sends — i.e. every website on the internet was allowed, with credentials.
// See CLAUDE.md CB-07.
//
// Both frontends call this service: the storefront for everything, and the
// admin panel for bestsellers and collections (AF-07).
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
  })
);

app.use(express.json());
app.use(cookieParser());

//app.post('/api/admin-login', controllers.adminLogin);

//app.use(authMiddleware);

// Routes
//app.use('/api', adminRoutes); // Prefix routes with /api;

// New customer routes
app.use('/api', customerRoutes);

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
// parameters, i.e. customer data. See CLAUDE.md CB-13.
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

const PORT = 9034;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
