import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, Search as SearchIcon } from "lucide-react";
import { CLIENT_API, apiFetch } from "../config/api";

/**
 * Product search, opened from the header.
 *
 * LAYOUT — drops from the TOP, not in from the right.
 *
 * It began as a right-hand drawer copied from the cart and wishlist panels, and
 * that was the wrong model. Those two show a LIST YOU OWN, so a tall side panel
 * suits them. Search is a text field first and a list second, and a side drawer
 * put the field in the top-right corner of a mostly empty column. Dropping from
 * the top puts the input where every shop puts it and gives the results the
 * full width of the screen.
 *
 * THE RESULTS SURFACE ONLY EXISTS WHILE THERE IS A QUERY. With an empty field
 * the page shows just the bar — no large empty white panel hanging over the
 * shop, which is the Amazon/Flipkart behaviour: the suggestion sheet appears as
 * you type and disappears when you clear.
 *
 * Server-side search, not a filter over an already-downloaded catalogue: the
 * shop holds 35 products today, so filtering in the browser would work and then
 * quietly stop finding things once the catalogue outgrows whatever the page had
 * fetched — a failure with no error attached to it.
 */
const SearchPanel = ({ onClose }) => {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Separates "you have not typed yet" from "we looked and found nothing".
  // Both leave `results` empty, and showing "No sarees found" to someone who
  // has typed nothing reads as a broken shop.
  const [searched, setSearched] = useState(false);

  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Whether to render the results sheet at all. Driven by the RAW field rather
  // than by `results.length`, so the sheet appears the moment typing starts and
  // can show "Searching…" — waiting for results would make the first keystroke
  // feel like nothing happened.
  const hasQuery = term.trim().length > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced search.
  //
  // 300ms so a request is not fired per keystroke — typing "kanchipuram" would
  // otherwise be eleven requests, ten of them already stale on arrival. The
  // AbortController matters just as much: without it a slow early response can
  // land AFTER a later one and overwrite the results with those of a prefix the
  // customer has already finished typing.
  useEffect(() => {
    const query = term.trim();

    if (!query) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(() => {
      apiFetch(
        `${CLIENT_API}/api/products/search?q=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      )
        .then(async (res) => {
          // ok BEFORE json(): an HTML error page throws on .json() and would
          // otherwise surface as a misleading network failure.
          if (!res.ok) throw new Error(`Search failed (HTTP ${res.status}).`);
          const body = await res.json();
          if (!body.success) throw new Error(body.message || "Search failed.");
          setResults(Array.isArray(body.data) ? body.data : []);
          setError(null);
          setSearched(true);
        })
        .catch((err) => {
          if (err.name === "AbortError") return; // superseded, not a failure
          console.error("Search failed:", err);
          setError("Could not search right now. Please try again.");
          setResults([]);
          setSearched(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const openProduct = (id) => {
    navigate(`/product/${id}`);
    onClose();
  };

  const money = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? `₹ ${n.toFixed(2)}` : "—";
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* --- TOP BAR --- */}
      <div
        className="
          relative w-full
          bg-[#FFF8F0] shadow-lg
          animate-in slide-in-from-top duration-200
        "
        role="dialog"
        aria-label="Product search"
      >
        {/* Full width on a phone; centred with a ceiling on larger screens, so
            the field does not stretch to 1900px on a desktop monitor. */}
        <div className="mx-auto w-full max-w-3xl flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
          <div className="relative flex-1 min-w-0">
            <SearchIcon
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#68232B]/40"
            />
            <input
              ref={inputRef}
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Try &quot;green silk&quot; or &quot;wedding&quot;…"
              maxLength={100}
              aria-label="Search products"
              className="
                w-full pl-10 pr-10 py-3 rounded-2xl
                bg-white border border-[#68232B]/15
                text-[#68232B] placeholder:text-[#68232B]/35
                focus:outline-none focus:border-[#68232B]/40 focus:ring-4 focus:ring-[#68232B]/5
                transition-all
              "
            />
            {term && (
              <button
                onClick={() => {
                  setTerm("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#68232B]/40 hover:text-[#68232B]"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close search"
            className="shrink-0 p-2 rounded-xl text-[#68232B] hover:bg-[#68232B]/5 transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        {/* --- RESULTS SHEET — only while there is something typed --- */}
        {hasQuery && (
          <div className="border-t border-[#68232B]/10 max-h-[70vh] overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-6 sm:py-4">
              {loading && (
                <p className="text-center text-sm text-[#68232B]/60 py-6">
                  Searching…
                </p>
              )}

              {!loading && error && (
                <p className="text-center text-sm text-red-700 py-6">{error}</p>
              )}

              {!loading && !error && searched && results.length === 0 && (
                <div className="text-center py-8">
                  <p className="font-semibold text-[#68232B]">No sarees found</p>
                  <p className="mt-2 text-sm text-[#68232B]/60">
                    Try a different colour, fabric or occasion.
                  </p>
                </div>
              )}

              {!loading && !error && results.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {results.map((p) => (
                    <li key={p.id}>
                      {/* A real <button>, so the row is keyboard reachable and
                          Enter/Space open it without extra handlers. */}
                      <button
                        onClick={() => openProduct(p.id)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-xl hover:bg-[#68232B]/5 transition-colors"
                      >
                        <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-lg overflow-hidden border border-[#68232B]/10 bg-white">
                          <img
                            src={p.image_url || "https://placehold.co/100?text=No+Img"}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = "https://placehold.co/100?text=No+Img";
                            }}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm sm:text-base text-[#68232B] truncate">
                            {p.name}
                          </p>
                          <p className="text-xs text-[#68232B]/50 truncate">
                            {p.category}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {/* Out-of-stock is stated rather than hidden: the
                              customer searched for it by name, so silently
                              omitting it looks like the shop never had it. */}
                          {!p.in_stock && (
                            <span className="rounded-full bg-[#68232B] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Sold out
                            </span>
                          )}
                          <p className="text-sm font-bold text-[#68232B] whitespace-nowrap">
                            {money(p.selling_price)}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- BACKDROP ---
          Below the bar in the flex column, so it covers only the page BELOW the
          search UI and can never sit over the input. `flex-1` rather than a
          fixed inset overlay for the same reason: an absolutely-positioned
          backdrop would need a z-index fight with the bar to stay behind it. */}
      <div
        className="flex-1 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>
  );
};

export default SearchPanel;
