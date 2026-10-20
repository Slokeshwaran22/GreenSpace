
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import { api } from "../api.js";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(event) {
    event.preventDefault();
    setLoading(true);

    try {
      await api.sendOtp(email.trim());
      setOtpSent(true);
      setOtpVerified(false);
      toast.success("OTP sent. Check your email.");
    } catch (error) {
      toast.error(error.message || "Unable to send OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(event) {
    event.preventDefault();
    setLoading(true);

    try {
      await api.verifyOtp(email.trim(), otp.trim());
      setOtpVerified(true);
      toast.success("OTP verified successfully.");
    } catch (error) {
      toast.error(error.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();

    if (newPassword.length < 8) {
      toast.error("Password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword(email.trim(), newPassword, confirmPassword);
      toast.success("Password reset successful. Please login.");
      navigate("/login");
    } catch (error) {
      toast.error(error.message || "Password reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset Password"
      description="Recover access to your GreenSpace account"
    >
      {!otpSent && (
        <form onSubmit={handleSendOtp}>
          <div className="form-group">
            <label htmlFor="forgot-email">Email Address</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your registered Gmail"
              autoComplete="email"
              required
            />
          </div>

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>
        </form>
      )}

      {otpSent && !otpVerified && (
        <form onSubmit={handleVerifyOtp}>
          <div className="form-group">
            <label htmlFor="forgot-otp">Enter OTP</label>
            <input
              id="forgot-otp"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="Enter the OTP from your email"
              autoComplete="one-time-code"
              required
            />
          </div>

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify OTP"}
          </button>

          <button
            className="secondary-button"
            type="button"
            disabled={loading}
            onClick={handleSendOtp}
          >
            Resend OTP
          </button>
        </form>
      )}

      {otpVerified && (
        <form onSubmit={handleResetPassword}>
          <PasswordField
            name="new-password"
            label="New Password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />

          <PasswordField
            name="confirm-password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      )}

      <p className="auth-footer">
        Remember your password? <Link to="/login">Back to Login</Link>
      </p>
    </AuthLayout>
  );
}
