
import { Routes, Route, Navigate } from "react-router-dom";

import Register from "./pages/Register";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";

export default function App() {
  return (
    <Routes>
      {/* Default page */}
      <Route
        path="/"
        element={<Navigate to="/register" replace />}
      />

      {/* Public routes */}
      <Route element={<PublicRoute />}>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />
      </Route>

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin/admindashboard"
          element={<AdminDashboard />}
        />
      </Route>

      {/* Unknown URL */}
      <Route
        path="*"
        element={<Navigate to="/register" replace />}
      />
    </Routes>
  );
}
