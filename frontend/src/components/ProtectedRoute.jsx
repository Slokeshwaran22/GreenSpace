import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { api } from "../api.js";

export default function ProtectedRoute() {
  const [status, setStatus] = useState("checking");
  const [profile, setProfile] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let active = true;

    async function checkAuthentication() {
      try {
        const result = await api.me();

        // Support either { user: {...} } or a direct user object
        const user = result?.user ?? result;
        console.log("ME API response:", result);
        console.log("User profile:", user);
        console.log("User role:", user?.role);

        if (!user || !user.role) {
          throw new Error("User profile or role is missing.");
        }

        if (active) {
          setProfile(user);
          setStatus("authenticated");
        }
      } catch (error) {
        console.error("Authentication check failed:", error);

        if (active) {
          setStatus("unauthenticated");
        }
      }
    }

    checkAuthentication();

    return () => {
      active = false;
    };
  }, []);

  if (status === "checking") {
    return <p>Checking authentication...</p>;
  }

  if (status === "unauthenticated") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  const role = String(profile?.role || "")
    .trim()
    .toLowerCase();

  const path = location.pathname;

  if (path === "/admin/admindashboard" && role !== "admin") {
    if (role === "user") {
      return <Navigate to="/user/userdashboard" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  if (path === "/user/userdashboard" && role !== "user") {
    if (role === "admin") {
      return <Navigate to="/admin/admindashboard" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}