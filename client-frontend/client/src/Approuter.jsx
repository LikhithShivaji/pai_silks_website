import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Homepage from "./Homepage";
import App from "./App";
import ViewProductPage from "./components/ViewProductPage";
import AboutUs from "./components/AboutUs";
import MyOrders from './MyOrders'
import MyProfile from "./MyProfile";
import Checkout from "./Checkout"
import LoginPage from "./LoginPage";
import PeacockLoader from "./components/PeacockLoader";
import Signup from "./components/Signup";
import PrivateRoute from "./components/PrivateRoute";

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
        <Route path="/animation" element={<PeacockLoader />} />
        <Route path="/signup" element={<Signup />} />

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
      </Routes>
    </Router>
  );
}