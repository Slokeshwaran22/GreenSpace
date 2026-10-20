import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import { api } from "../api.js";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    phone: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previousForm) => ({
      ...previousForm,  
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    // Prevent duplicate submissions
    if (loading) return;

    const username = form.username.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const password = form.password;

    // 1. Username validation
    if (!/^[a-zA-Z ]{2,}$/.test(username)) {
      toast.error("Enter a valid name using at least 2 letters.");
      return;
    }

    // 2. Phone number validation
    if (!/^[0-9]{10}$/.test(phone)) {
      toast.error("Enter a valid 10-digit phone number.");
      return;
    }

    // 3. Gmail validation
    if (!/^[a-z0-9.]+@gmail\.com$/i.test(email)) {
      toast.error(
        "Please enter a valid Gmail address ending in @gmail.com."
      );
      return;
    }

    // 4. Password validation
    if (password.length < 8) {
      toast.error("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      // 5. Send registration data to FastAPI
      await api.register({
        username,
        phone,
        email,
        password,
      });

      toast.success("Registration successful! Please login.");
      navigate("/login");
    } catch (error) {
      toast.error(
        error.message || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create Account"
      description="Join GreenSpace and get started"
    >
      <div className="nature-decorations" aria-hidden="true">
        <span className="nature-leaf leaf-one">🍃</span>
        <span className="nature-leaf leaf-two">🌿</span>
        <span className="nature-leaf leaf-three">🍃</span>
        <span className="nature-leaf leaf-four">🌱</span>
        <span className="nature-leaf leaf-five">🍃</span>
        <span className="nature-leaf leaf-six">🌿</span>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Username */}
        <div className="form-group">
          <label htmlFor="register-username">Username</label>

          <input
            id="register-username"
            name="username"
            type="text"
            value={form.username}
            onChange={handleChange}
            placeholder="Enter your name"
            autoComplete="name"
            maxLength={100}
            required
          />
        </div>

        {/* Phone number */}
        <div className="form-group">
          <label htmlFor="register-phone">Phone Number</label>

          <input
            id="register-phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            placeholder="10-digit phone number"
            inputMode="numeric"
            maxLength={10}
            autoComplete="tel"
            required
          />
        </div>

        {/* Email */}
        <div className="form-group">
          <label htmlFor="register-email">Email Address</label>

          <input
            id="register-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter your Gmail"
            autoComplete="email"
            maxLength={254}
            required
          />
        </div>

        {/* Password */}
        <PasswordField
          name="register-password"
          label="Password"
          value={form.password}
          onChange={(event) =>
            setForm((previousForm) => ({
              ...previousForm,
              password: event.target.value,
            }))
          }
          placeholder="Create a strong password"
          autoComplete="new-password"
        />

        {/* Submit */}
        <button
          className="primary-button"
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="auth-footer">
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </AuthLayout>
  );
}
