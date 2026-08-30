const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Read a required environment variable, or fail loudly at startup.
 *
 * This file previously fell back to hardcoded credentials
 * (`root` / `admin123` / `db`). Because .env held only the Cloudinary keys and
 * no DB_* variables, those fallbacks were not a safety net — they were the
 * live configuration, with a password written in plain text in a public
 * repository.
 *
 * Failing to boot is the correct behaviour for missing database config: a
 * server that silently connects somewhere unintended is far worse than one
 * that refuses to start. See CLAUDE.md AB-06.
 *
 * `allowEmpty` covers DB_PASS, since a blank password is a legitimate local
 * setup — but it must still be set deliberately, not merely absent.
 */
const required = (name, { allowEmpty = false } = {}) => {
  const value = process.env[name];

  if (value === undefined || (!allowEmpty && value === '')) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `  Local dev:  copy .env.example to .env and fill it in\n` +
      `  Production: set it in the Render dashboard (Service -> Environment)\n` +
      `  See DEPLOYMENT.md.`
    );
  }
  return value;
};

const pool = mysql.createPool({
  host: required('DB_HOST'),
  user: required('DB_USER'),
  password: required('DB_PASS', { allowEmpty: true }),
  database: required('DB_NAME'),
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,

  // Finite, was 0 (unbounded). With an unbounded queue a database stall does
  // not fail — it accumulates: every request waits for a connection that never
  // frees, the queue grows with memory, and each admin's browser spins until it
  // times out on its own. Nothing sheds load and nothing reports a problem.
  //
  // 50 is 5x connectionLimit — roughly a quarter-second of backlog at ~50ms per
  // query — so ordinary traffic spikes still queue and succeed, while a genuine
  // stall rejects the 51st waiter immediately. That surfaces as the generic 500
  // from the error handler in server.js, which is a far better outcome than a
  // hung request holding the connection open.
  //
  // Tune this from real traffic once the shop is live rather than leaving it
  // unbounded in the meantime. See CLAUDE.md AB-39.
  queueLimit: 50
});

// Pool-level errors arrive on the pool itself, not on any query's promise, so
// nothing above ever sees them. An idle connection dropped by the server —
// PROTOCOL_CONNECTION_LOST, ECONNRESET, or the MySQL `wait_timeout` reaping a
// connection that has sat unused — is emitted here.
//
// Without a listener this is not merely unlogged: an 'error' event with no
// handler is re-thrown by EventEmitter as an uncaught exception, which would
// take the whole process down for a condition mysql2 recovers from on its own
// by opening a fresh connection. Logging and continuing is the correct
// response. See CLAUDE.md AB-37.
pool.on('error', (err) => {
  console.error('[db pool]', err.code || err.message);
});

module.exports = pool;
