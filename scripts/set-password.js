#!/usr/bin/env node
/**
 * Generate a bcrypt hash and the UPDATE statement for a user's password.
 *
 * Supports CLAUDE.md SEC-02b (rotate the admin password) and DB-08 (three
 * accounts currently share one hash).
 *
 * The password is read from a hidden prompt — never an argument — so it does
 * not land in shell history, this repo, or any transcript. This script does NOT
 * write to any database; it only prints SQL for you to run where you choose.
 *
 * Usage:
 *   node scripts/set-password.js                      # defaults to the admin
 *   node scripts/set-password.js someone@example.com
 *
 * Then run the printed SQL against the database you are updating. Local and
 * Hostinger production are SEPARATE — running it on one does nothing to the
 * other.
 */

const path = require('path');
const readline = require('readline');

// Reuse the backend's own bcrypt and its cost constant, so this can never
// drift from what the application uses.
const BACKEND = path.join(__dirname, '..', 'client-backend');
const bcrypt = require(path.join(BACKEND, 'node_modules', 'bcrypt'));
const appDefines = require(path.join(BACKEND, 'src', 'constants', 'appDefines'));

const { BCRYPT_COST, MIN_LENGTH, MAX_BYTES } = appDefines.password;

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // Suppress echo so the password is not shown or scrolled back to.
    rl._writeToOutput = function (str) {
      if (str.includes(question)) rl.output.write(question);
    };
    rl.question(question, (answer) => {
      rl.output.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

(async () => {
  const email = process.argv[2] || 'admin123@gmail.com';

  console.log(`\nSetting password for: ${email}`);
  console.log(`bcrypt cost: ${BCRYPT_COST}   min length: ${MIN_LENGTH}   max: ${MAX_BYTES} bytes\n`);

  const password = await promptHidden('New password: ');
  const confirm = await promptHidden('Confirm password: ');

  if (password !== confirm) {
    console.error('\nPasswords do not match. Nothing generated.');
    process.exit(1);
  }
  if (password.length < MIN_LENGTH) {
    console.error(`\nToo short — minimum ${MIN_LENGTH} characters.`);
    process.exit(1);
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) {
    console.error(
      `\nToo long — bcrypt silently ignores anything past ${MAX_BYTES} bytes,` +
      `\nso the extra characters would add no security at all.`
    );
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, BCRYPT_COST);

  console.log(`\nbcrypt hash (cost ${BCRYPT_COST}):\n${hash}\n`);
  console.log('--- run this against the database you are updating ---\n');
  console.log(`UPDATE master_user SET pass = '${hash}' WHERE pri_email = '${email}';`);
  console.log('\n--- then confirm exactly one row changed ---\n');
  console.log(
    `SELECT user_id, user_name, pri_email, role_id, SUBSTRING(pass,1,7) AS cost\n` +
    `FROM master_user WHERE pri_email = '${email}';`
  );
  console.log(
    '\nReminder: local and Hostinger production are separate databases.\n' +
    'Running this on one does not affect the other.\n'
  );
})();
