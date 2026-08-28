import React from "react";

/**
 * Catches render-time crashes anywhere below it and shows a recoverable screen
 * instead of a blank white page.
 *
 * The admin app had NO error boundary at all — verified: zero matches for
 * ErrorBoundary / componentDidCatch / getDerivedStateFromError anywhere in
 * src/. A single throw during render took down the whole panel with no way
 * back. See CLAUDE.md AF-C-FIX.
 *
 * Deliberately NOT a copy of the storefront's boundary. That one is written for
 * a customer ("Sorry about that", a button to clear the saved cart) and neither
 * the tone nor the recovery action makes sense here: an admin has no cart, and
 * what they need is the actual error so they can report it. Same mechanism,
 * different audience.
 *
 * What this cannot catch, and why part 2 of the slice exists: errors thrown
 * inside an async .then() are not render errors. React never sees them, so a
 * boundary is powerless — they are swallowed by whatever .catch() follows.
 * Those sites need their own handling in AdminHomePage.
 *
 * Must be a class component — React has no hook equivalent of
 * componentDidCatch.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // A real crash, not debug noise. Logs the error only — no order or
    // customer data is passed here.
    console.error("Unhandled render error in admin panel:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
        <div className="max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold text-[#68232B] mb-3">
            Something went wrong
          </h1>
          <p className="text-gray-600 mb-6">
            The admin panel hit an unexpected error and stopped rendering this
            screen. Your data is safe — nothing was saved or changed.
          </p>

          {/* The message is shown because the person reading this is the site
              operator, not a customer. Without it there is nothing to report
              and nothing to search for. The stack is left in the console. */}
          {this.state.error?.message && (
            <pre className="text-left text-xs bg-white border border-gray-200 rounded-lg p-3 mb-6 overflow-x-auto text-gray-700">
              {String(this.state.error.message)}
            </pre>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="px-6 py-2.5 rounded-full bg-[#68232B] text-white hover:bg-[#8B2E39] transition-colors"
            >
              Reload page
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-6 py-2.5 rounded-full border border-[#68232B] text-[#68232B] hover:bg-[#68232B] hover:text-white transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
