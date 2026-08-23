import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AdminAppRouter from "./AdminAppRouter";

// LoginDetailsProvider (ContextApp.jsx) was removed here.
//
// It was mounted around the whole app but consumed by nothing — the only other
// reference was a comment in AdminLogin.jsx noting it had been dropped. Its
// mount effect ran on every page load and wrote the admin password to
// localStorage in plain text:
//
//     localStorage.setItem("password", password);
//
// It only ever wrote "" because no component called setPassword, but it was
// live code on the critical path, one wiring change away from persisting a real
// credential where any script on the page could read it. See CLAUDE.md AF-04.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AdminAppRouter />
  </StrictMode>
);
