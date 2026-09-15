import React, { useEffect, useRef, useState } from "react";
import { Package, Check, Loader2 } from "lucide-react";
import { CARRIERS, isValidConsignment } from "@/constants/carriers";

/**
 * Records which carrier took an order and its consignment number.
 *
 * WHY THIS EXISTS
 * Until this, an order could be marked "Shipped" with no way for the customer
 * to find the parcel — they saw a status badge and nothing else. DTDC assigns
 * API credentials only AFTER the site is live, and India Post has no
 * self-service API at all, so manual capture is not a stopgap: it is the only
 * tracking possible at launch. See CLAUDE.md DB-09.
 *
 * BUILT FOR A BARCODE SCANNER, NOT FOR TYPING
 * The shop has a scanner, and the carrier's receipt carries the consignment
 * number as a barcode. A scanner behaves as a keyboard: it types the value very
 * fast and then sends Enter. So:
 *
 *   - the carrier is chosen FIRST, because the scanner's trailing Enter submits
 *     — if the number were scanned before a carrier was picked, the submit
 *     would fire against an empty carrier and be rejected by the server;
 *   - the number field autofocuses once a carrier is set, so the admin can scan
 *     immediately without clicking into it;
 *   - Enter submits, so a scan completes the whole interaction with no clicks.
 *
 * Typing remains possible for a damaged or unreadable barcode, which is why the
 * format check below still earns its place.
 */
export default function DispatchEntry({
  orderId,
  currentCarrier,
  currentConsignment,
  onSave,
  disabled = false,
}) {
  const [carrier, setCarrier] = useState(currentCarrier || "");
  const [consignment, setConsignment] = useState(currentConsignment || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  // Re-sync when the parent swaps to a different order, or when a save comes
  // back with a normalised value (the server trims and upper-cases).
  useEffect(() => {
    setCarrier(currentCarrier || "");
    setConsignment(currentConsignment || "");
    setError("");
  }, [orderId, currentCarrier, currentConsignment]);

  // Focus the number field as soon as a carrier is chosen, so the next action
  // is simply "scan". Without this the admin has to click the field first, and
  // a scan aimed at an unfocused page goes nowhere.
  useEffect(() => {
    if (carrier && !currentConsignment) inputRef.current?.focus();
  }, [carrier, currentConsignment]);

  const submit = async () => {
    const value = consignment.trim().toUpperCase();

    if (!carrier) {
      setError("Choose the carrier first.");
      return;
    }
    if (!value) {
      setError("Scan or enter the consignment number.");
      inputRef.current?.focus();
      return;
    }
    // Local shape check. The server validates this too — this exists to catch a
    // mis-scan at the point of entry, while the receipt is still in hand,
    // rather than after a round trip.
    if (!isValidConsignment(carrier, value)) {
      setError(
        `That does not look like a ${carrier} consignment number. Check the receipt.`
      );
      inputRef.current?.select();
      return;
    }

    setError("");
    setSaving(true);
    try {
      // The parent owns the request and the optimistic update. It returns a
      // message on failure — most importantly the server's 409 when this number
      // is already recorded against a DIFFERENT order, which is the mistake a
      // scanner makes easy: right receipt, wrong order open.
      const failure = await onSave({ carrier, consignment_number: value });
      if (failure) {
        setError(failure);
        inputRef.current?.select();
      }
    } finally {
      setSaving(false);
    }
  };

  // The scanner's trailing Enter lands here and completes the save.
  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault(); // never let it submit a surrounding form
    submit();
  };

  const saved =
    currentConsignment &&
    currentConsignment === consignment.trim().toUpperCase() &&
    currentCarrier === carrier;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Package size={16} className="text-[#68232B] shrink-0" />

        {/* Carrier FIRST — see the note at the top of this file. */}
        <select
          value={carrier}
          onChange={(e) => {
            setCarrier(e.target.value);
            setError("");
          }}
          disabled={disabled || saving}
          aria-label="Carrier"
          className="border border-[#68232B]/30 rounded px-2 py-1 text-sm bg-white disabled:opacity-50"
        >
          <option value="">Carrier…</option>
          {CARRIERS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          ref={inputRef}
          value={consignment}
          onChange={(e) => {
            setConsignment(e.target.value);
            setError("");
          }}
          onKeyDown={onKeyDown}
          disabled={disabled || saving || !carrier}
          placeholder={carrier ? "Scan barcode…" : "Choose a carrier first"}
          aria-label="Consignment number"
          // Browsers love to autofill and autocorrect this. A consignment
          // number is not a word and must not be "helped".
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="border border-[#68232B]/30 rounded px-2 py-1 text-sm font-mono w-56 bg-white disabled:opacity-50"
        />

        <button
          type="button"
          onClick={submit}
          disabled={disabled || saving || !carrier || !consignment.trim()}
          className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-[#68232B] text-white disabled:opacity-40"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
        </button>

        {saved && !saving && (
          <span className="flex items-center gap-1 text-green-700 text-xs">
            <Check size={14} /> Saved
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
