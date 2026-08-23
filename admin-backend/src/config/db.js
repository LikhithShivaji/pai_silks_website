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
  queueLimit: 0
});

module.exports = pool;
