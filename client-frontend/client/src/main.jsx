import React from "react";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppRouter from './Approuter'
import { CartProvider } from './CartContext'
import "./index.css";
import { ToastProvider } from './ToastContext';

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
    <CartProvider>
      <AppRouter />
    </CartProvider>
    </ToastProvider>
  </React.StrictMode>
);
