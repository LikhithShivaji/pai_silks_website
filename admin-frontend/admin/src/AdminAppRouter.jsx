import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdminLogin from "./AdminLogin";
import AdminHomePage from "./AdminHomePage";
import ProtectedAdminRoute from "@/ProtectedAdminRoute"; // Adjust path if needed

export default function AdminAppRouter() {
  return (
    <Router>
      <Routes>
        {/* Login Page (Public) */}
        <Route path="/" element={<AdminLogin />} />

        {/* Dashboard (Protected) */}
        <Route 
          path="/admin-home-page" 
          element={
            <ProtectedAdminRoute>
              <AdminHomePage />
            </ProtectedAdminRoute>
          } 
        />
      </Routes>
    </Router>
  );
}