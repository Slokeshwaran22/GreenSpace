
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

  const [otpRequired, setOtpRequired] = useState(false);
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);

  // Navigate according to the user's role
  function navigateByRole(user) {
    if (!user || !user.role) {
      toast.error("User role was not returned by the server.");
      return;
    }

    const role = String(user.role).trim().toLowerCase();

    // Clear login fields after successful authentication
    setEmail("");
    setPassword("");
    setOtp("");
    setOtpRequired(false);

    if (role === "admin") {
      toast.success("Admin login successful!");
      navigate("/admin/admindashboard", { replace: true });
    } else if (role === "user") {
      toast.success("User login successful!");
      navigate("/user/userdashboard", { replace: true });
    } else {
      toast.error("Your account role is not recognized.");
    }
  }

  // Login with email and password
  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Please enter your email and password.");
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const response = await api.login({
        email: email.trim(),
        password,
        remember_me: rememberMe,
      });

      // OTP verification is required when Remember Me is unchecked
      if (response.otp_required) {
        setOtpRequired(true);
        setOtp("");
        toast.success("Login OTP sent to your registered Gmail.");
        return;
      }

      // Direct login when Remember Me is checked
      navigateByRole(response.user);
    } catch (error) {
      toast.error(
        error.message || "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // Verify login OTP
  async function handleVerifyOtp(event) {
    event.preventDefault();

    if (!/^\d{6}$/.test(otp)) {
      toast.error("Please enter a valid six-digit OTP.");
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const response = await api.verifyLoginOtp(
        email.trim(),
        otp
      );

      navigateByRole(response.user);
    } catch (error) {
      toast.error(
        error.message || "OTP verification failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // Return to the login form
  function backToLogin() {
    setOtpRequired(false);
    setOtp("");
  }

  return (
    <AuthLayout
      title={otpRequired ? "Verify Your Email" : "Welcome Back"}
      description={
        otpRequired
          ? "Enter the six-digit login OTP sent to your Gmail"
          : "Login to your GreenSpace account"
      }
    >
      {!otpRequired ? (
        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Email */}
          <div className="form-group">
            <label htmlFor="login-email">
              Email Address
            </label>

            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Enter your email"
              autoComplete="off"
              required
            />
          </div>

          {/* Password */}
          <PasswordField
            name="login-password"
            label="Password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            autoComplete="new-password"
          />

          {/* Remember Me */}
          <label>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) =>
                setRememberMe(event.target.checked)
              }
            />
            Remember me
          </label>

          {/* Forgot Password */}
          <div className="form-links">
            <Link to="/forgot-password">
              Forgot password?
            </Link>
          </div>

          {/* Login button */}
          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp}>
          {/* OTP */}
          <div className="form-group">
            <label htmlFor="login-otp">
              Six-Digit OTP
            </label>

            <input
              id="login-otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              value={otp}
              onChange={(event) =>
                setOtp(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6)
                )
              }
              placeholder="Enter OTP"
              required
            />
          </div>

          {/* OTP buttons */}
          <div className="otp-buttons">
            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

            <button
              className="secondary-button"
              type="button"
              disabled={loading}
              onClick={backToLogin}
            >
              Back to Login
            </button>
          </div>
        </form>
      )}

      <p className="auth-footer">
        Don't have an account?{" "}
        <Link to="/register">Register</Link>
      </p>
    </AuthLayout>
  );
}
