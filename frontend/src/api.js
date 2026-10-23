
const API_URL = "http://localhost:8000";

// Common function to send requests to FastAPI
async function request(path, options = {}) {
  let response;

  try {
    const isFormData =
      typeof FormData !== "undefined" &&
      options.body instanceof FormData;

    response = await fetch(`${API_URL}${path}`, {
      ...options,

      // Include session cookies for authentication
      credentials: "include",

      headers: {
        // Do not set Content-Type manually for FormData.
        // The browser must add the multipart boundary.
        ...(isFormData
          ? {}
          : { "Content-Type": "application/json" }),

        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot connect to backend. Please check FastAPI."
    );
  }

  // Read the backend response safely
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

  return data;
}

// API functions used by React components
export const api = {
  // -------------------------
  // AUTHENTICATION
  // -------------------------

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

  // Check logged-in user / role
  checkRole: () => request("/me"),

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

  // Send password reset OTP
  sendOtp: (email) =>
    request("/forgot-password/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  // Verify password reset OTP
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

  // -------------------------
  // GENERIC API REQUESTS
  // -------------------------

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

  // -------------------------
  // PROJECT MANAGEMENT
  // -------------------------

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

  // -------------------------
  // FILE MANAGEMENT
  // -------------------------

  // Upload a file
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append("file", file);

    return request("/files/upload", {
      method: "POST",
      body: formData,
    });
  },

  // List all shared files with optional filters
  listFiles: (filters = {}) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        params.set(key, value);
      }
    });

    const query = params.toString();

    return request(
      `/files${query ? `?${query}` : ""}`
    );
  },

  // Delete a file
  // Backend checks whether the user owns the file or is an admin.
  deleteFile: (id) =>
    request(`/files/${id}`, {
      method: "DELETE",
    }),

  // Get URL for viewing a PDF or image
  fileViewUrl: (id) =>
    `${API_URL}/files/${id}/view`,

  // Get URL for downloading a file
  fileDownloadUrl: (id) =>
    `${API_URL}/files/${id}/download`,
};
