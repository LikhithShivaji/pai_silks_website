import { useState } from "react"; // Removed useContext and ContextApp
import { useNavigate } from "react-router-dom";
import { ADMIN_API, apiFetch } from "@/config/api";
// AdminLogin.css deleted — 74 lines whose selectors (.login-page, .login-area,
// .admin-image-section, .login-credentials-section, .form) matched no element in
// this component. The layout is Tailwind. Verified before removal: the only
// "form" matches in this file were `formData` and the `<form>` tag itself.
// See CLAUDE.md CF-50 / AF-37.
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
      const response = await apiFetch(
        `${ADMIN_API}/api/admin-login`,
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

      // Gate on the HTTP status, not a body field.
      //
      // This previously checked `data.validSession`, which the backend only
      // returned on its "a session already exists" branch. A genuine FIRST
      // login took the other branch, had no validSession key, and fell through
      // to the failure path — alerting "Login successful" as an ERROR while
      // leaving the admin on this page. Logging in required clicking LOGIN
      // twice. See CLAUDE.md AF-16.
      //
      // The backend now returns a consistent { success } shape and always
      // issues a full cookie set, so response.ok is the honest signal.
      if (response.ok && data.success) {
        // UI hint only — the real credential is the httpOnly session cookie,
        // which JavaScript cannot read. ProtectedAdminRoute verifies against
        // the server, so setting this by hand grants nothing.
        localStorage.setItem("admin_auth", "true");

        if (data.user) {
          localStorage.setItem("admin_user", JSON.stringify(data.user));
        }

        navigate("/admin-home-page");
      } else {
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

              {/* "Keep me logged in" removed. See CLAUDE.md AF-26.
                  It was `defaultChecked` with no `checked`, no `onChange` and
                  no reference anywhere in the submit handler — permanently
                  ticked, and doing nothing. Removed rather than wired because
                  session lifetime is set server-side by the JWT's `exp` claim
                  (Phase 2); honouring this box would mean issuing tokens with
                  different expiries, which is a real auth change and not
                  something to infer from an unwired checkbox. */}

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