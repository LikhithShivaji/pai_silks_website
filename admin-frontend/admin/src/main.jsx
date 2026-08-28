import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AdminAppRouter from "./AdminAppRouter";
import ErrorBoundary from "./components/ErrorBoundary";
// Inside the boundary, so a crash in a page still renders the recovery screen.
import { ToastProvider } from "./ToastContext";

// LoginDetailsProvider (ContextApp.jsx) was removed here.
//
// It was mounted around the whole app but consumed by nothing — the only other
// reference was a comment in AdminLogin.jsx noting it had been dropped. Its
// mount effect ran on every page load and wrote the admin password to
// localStorage in plain text:
//
//     localStorage.setItem("password", password);
//
// It only ever wrote "" because no component called setPassword, but it was
// live code on the critical path, one wiring change away from persisting a real
// credential where any script on the page could read it. See CLAUDE.md AF-04.
// ErrorBoundary wraps the whole router. Until now the admin app had none at
// all, so any render-phase throw — a null first product, a malformed order row
// — white-screened the entire panel with no way back. See CLAUDE.md AF-C-FIX.
//
// It sits INSIDE StrictMode but OUTSIDE the router, so a crash on any route
// still renders the recovery screen rather than an empty document.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AdminAppRouter />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);
