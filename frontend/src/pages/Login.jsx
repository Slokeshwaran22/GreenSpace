
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import { api } from "../api.js";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      await api.login({
        email: email.trim(),
        password,
        remember_me: rememberMe,
      });

      toast.success("Login successful!");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(error.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome Back"
      description="Login to your GreenSpace account"
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="login-email">Email Address</label>
          <input
            id="login-email"
            name="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            autoComplete="off"
            required
          />
        </div>

        <PasswordField
          name="login-password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <label>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          Remember me
        </label>

        <div className="form-links">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button
          className="primary-button"
          type="submit"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className="auth-footer">
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </AuthLayout>
  );
}
