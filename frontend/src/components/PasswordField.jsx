import { useState } from "react";

export default function PasswordField({
  label = "Password",
  name,
  value,
  onChange,
  required = true,
  autoComplete = "current-password",
  placeholder = "Enter your password",
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>

      <div className="password-input-wrap">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />

        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((previous) => !previous)}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? "🙈" : "👁️"}
        </button>
      </div>
    </div>
  );
}