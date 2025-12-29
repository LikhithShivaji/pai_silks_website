import React, { createContext, useState, useContext, useEffect } from "react";
import { Check, AlertCircle, X, Heart, ShoppingBag } from "lucide-react";

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Function to trigger the toast
  // Type can be: 'success', 'error', 'wishlist', 'cart'
  const showToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container - Fixed Position */}
      <div className="fixed top-20 right-2 sm:right-5 z-100 flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// --- THE TOAST COMPONENT ---
const ToastItem = ({ message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in animation
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Icon Logic
  const getIcon = () => {
    switch (type) {
      case "wishlist": return <Heart className="fill-[#BD7923] text-[#BD7923]" size={20} />;
      case "cart": return <ShoppingBag className="text-[#BD7923]" size={20} />;
      case "error": return <AlertCircle className="text-red-500" size={20} />;
      default: return <Check className="text-green-600" size={20} />;
    }
  };

  return (
    <div
      className={`
        pointer-events-auto
        flex items-center gap-4
        min-w-75 max-w-sm
        p-4 rounded-xl
        bg-white/90 backdrop-blur-md
        border border-[#68232B]/10
        shadow-[0_8px_30px_rgb(0,0,0,0.12)]
        transition-all duration-500 ease-out transform
        ${isVisible ? "translate-y-0 opacity-100 scale-100" : "translate-y-10 opacity-0 scale-95"}
      `}
    >
      {/* Icon Bubble */}
      <div className={`
        p-2 rounded-full shrink-0
        ${type === 'error' ? 'bg-red-50' : 'bg-[#FFF8F0]'}
      `}>
        {getIcon()}
      </div>

      {/* Message */}
      <div className="flex-1">
        <p className="text-[#68232B] font-medium text-sm font-['Poppins']">
          {message}
        </p>
      </div>

      {/* Close Button */}
      <button 
        onClick={onClose}
        className="text-[#68232B]/40 hover:text-[#68232B] transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
};