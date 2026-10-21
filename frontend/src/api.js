
const API_URL = "http://localhost:8000";

// Common function to send requests to FastAPI
async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,

      // Include session cookies
      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot connect to backend. Please check FastAPI."
    );
  }

  // Read the backend response
  const data = await response.json().catch(() => ({}));

  // Handle backend errors
  if (!response.ok) {
    const detail = data.detail;

    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(", ")
      : typeof detail === "string"
        ? detail
        : data.message || "Request failed.";

    throw new Error(message);
  }

  // Return JSON data directly
  return data;
}

// API functions used by React components
export const api = {
  // Login
  login: (payload) =>
    request("/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Verify login OTP
  verifyLoginOtp: (email, otp) =>
    request("/login/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),

  // Get logged-in user details
  me: () => request("/me"),

  // Generic GET request
  get: (path) => request(path),

  // Generic POST request
  post: (path, payload) =>
    request(path, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Generic PATCH request
  patch: (path, payload) =>
    request(path, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Logout
  logout: () =>
    request("/logout", {
      method: "POST",
    }),

  // Register a new user
  register: (payload) =>
    request("/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Send OTP to email
  sendOtp: (email) =>
    request("/forgot-password/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  // Verify OTP
  verifyOtp: (email, otp) =>
    request("/forgot-password/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),

  // Reset password
  resetPassword: (email, newPassword, confirmPassword) =>
    request("/forgot-password/reset", {
      method: "POST",
      body: JSON.stringify({
        email,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    }),

  // Check logged-in user / role
  checkRole: () => request("/me"),

  // Get all projects
  listProjects: () => request("/projects"),

  // Create a project
  createProject: (payload) =>
    request("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Update a project
  updateProject: (id, payload) =>
    request(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  // Delete a project
  deleteProject: (id) =>
    request(`/projects/${id}`, {
      method: "DELETE",
    }),
};
