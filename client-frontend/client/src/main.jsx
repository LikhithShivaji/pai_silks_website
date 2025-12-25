import React from "react";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppRouter from './Approuter'
import { CartProvider } from './CartContext'
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CartProvider>
      <AppRouter />
    </CartProvider>
  </React.StrictMode>
);
