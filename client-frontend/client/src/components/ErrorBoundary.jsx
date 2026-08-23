import React from "react";

/**
 * Catches render-time crashes anywhere below it and shows a recoverable page
 * instead of a blank white screen.
 *
 * The app previously had no error boundary at all, so a single throw during
 * render took down every route with no way back. See CLAUDE.md CF-10.
 *
 * "Clear saved data" exists because the most likely cause is a corrupt
 * `cart` / `wishlist` value in localStorage, which reproduces on every reload
 * and leaves the visitor permanently stuck. Clearing those two keys is enough
 * to recover, and it does not touch the user's login.
 *
 * Must be a class component — React has no hook equivalent of
 * componentDidCatch.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Kept intentionally: this is a real crash, not debug noise. It logs the
    // error only, never customer data.
    console.error("Unhandled render error:", error, errorInfo);
  }

  handleClearData = () => {
    try {
      localStorage.removeItem("cart");
      localStorage.removeItem("wishlist");
    } catch {
      // localStorage can throw in private-browsing modes. Reloading is still
      // worth attempting.
    }
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF8F4] px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[#68232B] mb-3">
            Something went wrong
          </h1>
          <p className="text-gray-600 mb-8">
            Sorry about that. Reloading usually fixes it. If this page keeps
            coming back, clearing your saved cart data should resolve it.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-md bg-[#68232B] text-white font-semibold hover:opacity-90 transition"
            >
              Reload page
            </button>
            <button
              onClick={this.handleClearData}
              className="px-6 py-3 rounded-md border border-[#68232B] text-[#68232B] font-semibold hover:bg-[#68232B]/5 transition"
            >
              Clear saved data
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
