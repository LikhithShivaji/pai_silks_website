import React from "react";
import { ShieldAlert } from "lucide-react";

/**
 * Shown when the admin has opened the panel more times than the hourly limit
 * allows (pageLoadLimiter, mounted on /api/verify-token).
 *
 * This is NOT a logout. The session is still valid and nothing has been
 * revoked — which is precisely why it needs its own screen. Bouncing to the
 * login page, as the guard used to do for any non-OK response, told the admin
 * their session had ended and invited them to log in again, which would not
 * have helped and is not what happened.
 *
 * ⚠️ The email-verification route is DELIBERATELY not offered as a working
 * control yet. There is no outbound mail channel in this project, so a code
 * input that accepted typing would be claiming an email had been sent when none
 * was — the same dishonesty as the "Subscribe" form that subscribed nobody. It
 * is shown as clearly unavailable until the mail work lands, at which point the
 * disabled block below becomes the real form.
 */
export default function RateLimited({ retryAfterSeconds = null, onRetry = null }) {
  // The server sends Retry-After in seconds. Rounded UP, because telling
  // someone to wait "0 minutes" when 40 seconds remain is worse than saying 1.
  const minutes =
    Number.isFinite(Number(retryAfterSeconds)) && Number(retryAfterSeconds) > 0
      ? Math.ceil(Number(retryAfterSeconds) / 60)
      : null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FFF8F0] p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-8 sm:p-10 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#68232B] flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-[#FEDB87]" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#68232B] mb-3">
          Too many attempts
        </h1>

        <p className="text-gray-600 leading-relaxed">
          You have reached the limit for opening the admin panel. This is a
          security measure to protect the shop&apos;s data.
        </p>

        <p className="mt-4 text-gray-700 font-medium">
          {minutes
            ? `Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`
            : "Please try again in an hour."}
        </p>

        {/* Not yet available — see the note at the top of this file. Rendered so
            the admin knows the faster route is coming, and disabled so nobody
            waits for an email that cannot be sent. */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Or verify by email
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              disabled
              placeholder="Verification code"
              aria-label="Verification code (not yet available)"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 placeholder:text-gray-300"
            />
            <button
              type="button"
              disabled
              className="px-5 py-3 rounded-xl bg-gray-200 text-gray-400 font-semibold"
            >
              Verify
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Email verification is not set up yet — please use the waiting time
            above for now.
          </p>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-8 w-full py-3 rounded-xl bg-[#68232B] text-white font-semibold hover:bg-[#8B2E39] transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
