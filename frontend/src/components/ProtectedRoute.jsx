
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { api } from "../api.js";

export default function ProtectedRoute() {
  const [status, setStatus] = useState("checking");
  const location = useLocation();

  useEffect(() => {
    let active = true;

    async function checkAuthentication() {
      try {
        await api.me();

        if (active) {
          setStatus("authenticated");
        }
      } catch (error) {
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
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
