import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Homepage from "./Homepage";
import App from "./App";
import ViewProductPage from "./components/ViewProductPage";
import AboutUs from "./components/AboutUs";
import MyOrders from './MyOrders'
import MyProfile from "./MyProfile";
import Checkout from "./Checkout"
import LoginPage from "./LoginPage";
// NOTE: PeacockLoader is NOT imported here any more, and that is not a
// removal of the component — it is still the loading spinner used by
// Homepage, App and ViewProductPage. What went away is the /animation route
// that published it as a standalone public page, where it rendered a
// fullscreen spinner that never resolved, with no header, footer or way out.
// See CLAUDE.md CF-08.
import Signup from "./components/Signup";
import PrivateRoute from "./components/PrivateRoute";
import NotFound from "./components/NotFound";
import ForgotPassword from "./components/ForgotPassword";

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        {/* --- Public --- */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Homepage />} />
        <Route path="/shop" element={<App />} />
        <Route path="/product/:productId" element={<ViewProductPage />} />
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/signup" element={<Signup />} />

        {/* LoginPage has always linked here; the route never existed, so
            "Forgot Password?" rendered a blank page. Not a self-service reset —
            there is no mail channel configured — so it routes to a human. */}
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* --- Requires a valid session ---
            These previously rendered for anyone. PrivateRoute asks the server,
            not localStorage — see CLAUDE.md CF-08. It is a UX guard only; the
            API enforces auth independently on every one of these pages' calls. */}
        <Route
          path="/my-orders"
          element={<PrivateRoute><MyOrders /></PrivateRoute>}
        />
        <Route
          path="/my-profile"
          element={<PrivateRoute><MyProfile /></PrivateRoute>}
        />
        <Route
          path="/checkout"
          element={<PrivateRoute><Checkout /></PrivateRoute>}
        />

        {/* ⚠️ CATCH-ALL — keep this LAST.
            Without it, any unmatched URL rendered a blank white page with no
            header, footer or way back. React Router ranks routes by specificity
            rather than declaration order, so this is safe where it sits, but
            keeping it last is how the file stays readable. */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}