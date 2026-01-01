import { useState } from "react"; // Removed useContext and ContextApp
import { useNavigate } from "react-router-dom";
import "./AdminLogin.css"; 
import logo from "./assets/pai-silks-logo.png";
import { Loader2 } from "lucide-react";

// --- SHADCN IMPORTS ---
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function AdminLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // 1. Unified Local State
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    // This now correctly updates the local state
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const loginCheck = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        "https://pai-silks-website.onrender.com/api/admin-login", // URL from your Postman
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            pri_email: formData.email, // Key matches Postman
            passwd: formData.password  // Key matches Postman
          }),
        }
      );

      const data = await response.json();
      console.log("API Response:", data); // Check console to be sure

      // 👇 FIX: Check 'validSession' instead of 'success'
      if (data.validSession) {
        
        // Save token if it exists (your response didn't show one, but just in case)
        localStorage.setItem("admin_auth", "true");
        if (data.token) localStorage.setItem("admin_token", data.token);
        
        // Save user details if they exist
        if (data.user || data.data) {
             localStorage.setItem("admin_user", JSON.stringify(data.user || data.data));
        }

        alert("Log In successful!");
        navigate("/admin-home-page");
      } else {
        // Fallback for failure
        alert(data.message || "Invalid credentials.");
      }
    } catch (error) {
      console.error("Login Error:", error);
      alert("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full">
      <div className="hidden lg:flex w-1/2 bg-black items-center justify-center border-r">
        <img src={logo} className="w-[60%] object-contain" alt="Pai Silks Logo" />
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <Card className="w-full max-w-md shadow-xl border-none bg-white/50 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center">
            <div className="lg:hidden flex justify-center mb-4">
               <img src={logo} className="w-32" alt="Logo" />
            </div>
            <CardTitle className="text-3xl font-bold text-[#68232B]">
              Admin Login
            </CardTitle>
            <CardDescription>
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={loginCheck} className="space-y-6">
              
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"  // 3. Added 'name' attribute so handleChange works
                  type="email"
                  placeholder="admin@paisilks.com"
                  required
                  value={formData.email} // 4. Bind to local state
                  onChange={handleChange}
                  className="h-12 border-gray-300 focus:border-[#68232B] focus:ring-[#68232B]"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  name="password" // 5. Added 'name' attribute
                  type="password"
                  placeholder="**********"
                  required
                  value={formData.password} // 6. Bind to local state
                  onChange={handleChange}
                  className="h-12 border-gray-300 focus:border-[#68232B] focus:ring-[#68232B]"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="keep-logged-in" defaultChecked className="data-[state=checked]:bg-[#68232B] border-[#68232B]" />
                <label
                  htmlFor="keep-logged-in"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Keep me logged in
                </label>
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-12 bg-[#68232B] hover:bg-[#8B2E39] text-white text-lg font-semibold transition-all duration-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "LOGIN"
                )}
              </Button>

            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
             <p className="text-xs text-gray-400">© 2025 Pai Silks Admin Panel</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default AdminLogin;