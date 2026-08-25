/**
 * Supported calling countries.
 *
 * The shop sells into India and the USA (owner, 2026-08-25). A dropdown of
 * known countries beats a free-text field: it removes the ambiguity of whether
 * "9876543210" is Indian or American, and it makes the stored value
 * unambiguous — every number goes into the database in E.164 form.
 *
 * Both countries happen to use 10-digit national numbers, so the input field
 * itself is identical; only the validation rule and the stored prefix differ.
 *
 * Keep this in sync with client-backend/src/middlewares/validators.js — the
 * server re-validates independently and is the authority.
 */
export const COUNTRIES = [
  {
    code: "IN",
    dial: "+91",
    label: "India",
    flag: "🇮🇳",
    // Indian mobile numbers begin 6-9. Landlines are not accepted; a delivery
    // contact needs to be reachable on the move.
    pattern: /^[6-9]\d{9}$/,
    hint: "10 digits, starting 6-9",
    example: "9876543210",
  },
  {
    code: "US",
    dial: "+1",
    label: "USA",
    flag: "🇺🇸",
    // NANP: area code and exchange code both start 2-9. Rules out 0/1 leading
    // groups, which are never assignable.
    pattern: /^[2-9]\d{2}[2-9]\d{6}$/,
    hint: "10 digits, area code first",
    example: "4155552671",
  },
];

export const DEFAULT_COUNTRY = "IN";

export const getCountry = (code) =>
  COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];

/** Strip everything that is not a digit — spaces, hyphens, brackets. */
export const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

/**
 * Validate a national number against its country's rule.
 * Returns an error string, or null when valid.
 */
export const validateNationalNumber = (countryCode, value) => {
  const country = getCountry(countryCode);
  const digits = digitsOnly(value);

  if (!digits) return "Phone number is required";
  if (digits.length !== 10) return `Enter 10 digits (${country.hint})`;
  if (!country.pattern.test(digits)) return `Not a valid ${country.label} number`;

  return null;
};

/**
 * Combine a country and a national number into the E.164 value that gets
 * stored. This is the ONLY thing that should ever reach the API.
 *
 *   ("IN", "98765 43210")  ->  "+919876543210"
 *   ("US", "(415) 555-2671") -> "+14155552671"
 */
export const toE164 = (countryCode, value) =>
  `${getCountry(countryCode).dial}${digitsOnly(value)}`;

/**
 * Split a stored E.164 value back into { countryCode, nationalNumber } so a
 * form can be pre-filled from a previous order.
 *
 * Falls back to the default country when the stored value predates this format
 * — older rows hold bare 10-digit numbers, and some hold the literal
 * "9999999999" that the broken checkout wrote on every order before CF-09 was
 * fixed. Those are returned as-is rather than guessed at.
 *
 *   "+919876543210" -> { countryCode: "IN", nationalNumber: "9876543210" }
 *   "+14155552671"  -> { countryCode: "US", nationalNumber: "4155552671" }
 *   "9876543210"    -> { countryCode: "IN", nationalNumber: "9876543210" }
 */
export const fromE164 = (stored) => {
  const raw = String(stored ?? "").trim();

  // Longest dial code first, so "+91" is not shadowed by "+1".
  const byLength = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

  for (const c of byLength) {
    if (raw.startsWith(c.dial)) {
      return { countryCode: c.code, nationalNumber: digitsOnly(raw.slice(c.dial.length)) };
    }
  }

  return { countryCode: DEFAULT_COUNTRY, nationalNumber: digitsOnly(raw) };
};
