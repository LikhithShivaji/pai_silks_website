import React from "react";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppRouter from './Approuter'
import { CartProvider } from './CartContext'
import "./index.css";
import { ToastProvider } from './ToastContext';
import { AuthProvider } from './AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// ErrorBoundary is deliberately OUTSIDE CartProvider. CartProvider reads and
// parses localStorage on mount, which is the most likely place to throw — a
// boundary nested inside it could not catch its own provider's crash.
// See CLAUDE.md CF-10.
//
// AuthProvider wraps CartProvider, and the order matters: the cart must know
// whether the visitor is signed in before deciding whether to sync with the
// server or run in guest mode. It previously answered that from
// localStorage.getItem("user_id"), so a stale key silently dropped a logged-in
// customer into guest mode and their cart never reached the database.
// See CLAUDE.md CF-55.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <AppRouter />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
