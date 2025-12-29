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

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Homepage />} />
        <Route path="/shop" element={<App />} />
        <Route path="/product/:productId" element={<ViewProductPage />} />
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/my-profile" element={<MyProfile />} />
        <Route path="/animation" element={<PeacockLoader />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </Router>
  );
}