import React from "react";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppRouter from './Approuter'
import { CartProvider } from './CartContext'
import "./index.css";
import { ToastProvider } from './ToastContext';
import ErrorBoundary from './components/ErrorBoundary';

// ErrorBoundary is deliberately OUTSIDE CartProvider. CartProvider reads and
// parses localStorage on mount, which is the most likely place to throw — a
// boundary nested inside it could not catch its own provider's crash.
// See CLAUDE.md CF-10.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <CartProvider>
          <AppRouter />
        </CartProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
