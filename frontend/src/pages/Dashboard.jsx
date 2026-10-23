
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../api.js";
import "../styles/Dashboard.css";

const emptyProject = {
  name: "",
  description: "",
  location: "",
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messagesError, setMessagesError] = useState("");

  const [form, setForm] = useState(emptyProject);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingMessageId, setUpdatingMessageId] = useState(null);

  const isAdmin =
    String(profile?.role || "").trim().toLowerCase() === "admin";

  // Load projects
  const loadProjects = useCallback(async () => {
    const result = await api.listProjects();
    setProjects(result.projects || []);
  }, []);

  // Load profile and projects
  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const result = await api.me();
        console.log("User profile:", result);

        if (!active) return;

        setProfile(result.user);

        const projectResult = await api.listProjects();

        if (active) {
          setProjects(projectResult.projects || []);
        }
      } catch (error) {
        if (active) {
          toast.error(
            error.message || "Unable to load dashboard."
          );
          navigate("/login", { replace: true });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [navigate]);

  // Load messages for the logged-in user
  const loadMessages = useCallback(async () => {
    try {
      const result = await api.get("/messages/");

      setMessages(result.messages || []);
      setMessagesError("");
    } catch (error) {
      setMessagesError(
        error.message || "Unable to load messages."
      );
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Check user role
  async function handleCheckRole() {
    try {
      const result = await api.checkRole();

      setProfile(result.user);

      toast.info(`Your role is: ${result.user.role}`);
    } catch (error) {
      toast.error(error.message || "Unable to check role.");
    }
  }

  // Logout
  async function handleLogout() {
    try {
      await api.logout();

      toast.success("Logged out successfully.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error.message || "Logout failed.");
    }
  }

  // Mark a message as read
  async function handleMarkAsRead(messageId) {
    setUpdatingMessageId(messageId);

    try {
      await api.patch(`/messages/${messageId}/read`, {});

      setMessages((previousMessages) =>
        previousMessages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                is_read: 1,
                read_at: new Date().toISOString(),
              }
            : message
        )
      );

      toast.success("Message marked as read.");
    } catch (error) {
      toast.error(
        error.message || "Unable to mark message as read."
      );
    } finally {
      setUpdatingMessageId(null);
    }
  }

  // Edit project
  function handleEdit(project) {
    setEditingId(project.id);

    setForm({
      name: project.name,
      description: project.description || "",
      location: project.location || "",
    });
  }

  // Create or update project
  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);

    try {
      if (editingId !== null) {
        await api.updateProject(editingId, form);
        toast.success("Project updated.");
      } else {
        await api.createProject(form);
        toast.success("Project created.");
      }

      setForm(emptyProject);
      setEditingId(null);

      await loadProjects();
    } catch (error) {
      toast.error(error.message || "Unable to save project.");
    } finally {
      setSaving(false);
    }
  }

  // Delete project
  async function handleDelete(id) {
    if (!window.confirm("Delete this project?")) {
      return;
    }

    try {
      await api.deleteProject(id);

      toast.success("Project deleted.");

      await loadProjects();
    } catch (error) {
      toast.error(error.message || "Unable to delete project.");
    }
  }

  // Loading state
  if (loading) {
    return (
      <p className="dashboard-loading">
        Loading GreenSpace dashboard...
      </p>
    );
  }

  if (!profile) {
    return null;
  }

  const unreadCount = messages.filter(
    (message) => !message.is_read
  ).length;

  return (
    <div className="gs-dashboard">
      {/* Sidebar */}
      <aside className="gs-sidebar">
        <h2 className="gs-brand">🌿 GreenSpace</h2>

        <nav
          className="gs-navigation"
          aria-label="Dashboard navigation"
        >
          <a className="gs-nav-link active" href="#profile">
            👤 My Profile
          </a>

          <a className="gs-nav-link" href="#messages">
            ✉️ Messages Inbox
          </a>

          <a className="gs-nav-link" href="#projects">
            🌱 GreenSpace Projects
          </a>
        </nav>

        <button
          className="gs-logout"
          type="button"
          onClick={handleLogout}
        >
          ↪ Logout
        </button>
      </aside>

      {/* Main content */}
      <main className="gs-main">
        {/* Dashboard header */}
        <header className="gs-header">
          <div>
            <p className="gs-eyebrow">GREENSPACE / DASHBOARD</p>

            <h1>Welcome, {profile.username}!</h1>

            <p className="gs-subtitle">
              Manage your account and stay connected.
            </p>
          </div>

          <div className="gs-admin-label">
            <div className="gs-avatar">
              {profile.username?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <div>
              <strong>{profile.username}</strong>
              <small>{isAdmin ? "Administrator" : "User account"}</small>
            </div>
          </div>
        </header>

        {/* Statistic cards */}
        <section className="gs-stat-grid">
          <article className="gs-stat-card">
            <div className="gs-stat-icon">👤</div>
            <div>
              <p>Account Status</p>
              <h2>Active</h2>
            </div>
          </article>

          <article className="gs-stat-card">
            <div className="gs-stat-icon">✉️</div>
            <div>
              <p>Unread Messages</p>
              <h2>{unreadCount}</h2>
            </div>
          </article>

          <article className="gs-stat-card">
            <div className="gs-stat-icon">🌱</div>
            <div>
              <p>GreenSpace Projects</p>
              <h2>{projects.length}</h2>
            </div>
          </article>
        </section>

        {/* Profile */}
        <section className="gs-panel" id="profile">
          <div className="gs-panel-header">
            <div>
              <h2>My Profile</h2>
              <p>Your registered account information.</p>
            </div>

            <span className="gs-count">
              {isAdmin ? "Admin" : "User"}
            </span>
          </div>

          <div className="gs-profile-details">
            <div className="gs-profile-row">
              <span className="gs-detail-icon">👤</span>
              <div>
                <small>Name</small>
                <strong>{profile.username}</strong>
              </div>
            </div>

            <div className="gs-profile-row">
              <span className="gs-detail-icon">✉️</span>
              <div>
                <small>Email</small>
                <strong>{profile.email}</strong>
              </div>
            </div>

            <div className="gs-profile-row">
              <span className="gs-detail-icon">📱</span>
              <div>
                <small>Phone</small>
                <strong>{profile.phone || "Not provided"}</strong>
              </div>
            </div>

            <div className="gs-profile-row">
              <span className="gs-detail-icon">🛡️</span>
              <div>
                <small>Role</small>
                <strong>{isAdmin ? "Admin" : "User"}</strong>
              </div>
            </div>
          </div>

          <button
            className="gs-action-button gs-primary-button"
            type="button"
            onClick={handleCheckRole}
          >
            🛡️ Check Role
          </button>
        </section>

        {/* Messages Inbox */}
        <section className="gs-panel" id="messages">
          <div className="gs-panel-header">
            <div>
              <h2>Messages Inbox</h2>
              <p>
                Messages from the GreenSpace administration team.
              </p>
            </div>

            <span className="gs-count">
              {unreadCount} unread
            </span>
          </div>

          <p className="gs-section-description">
            You have {unreadCount} unread message(s).
          </p>

          {messagesError && (
            <p className="gs-error-message" role="alert">
              {messagesError}
            </p>
          )}

          {!messagesError && messages.length === 0 && (
            <p className="gs-empty">
              No messages received yet.
            </p>
          )}

          {messages.length > 0 && (
            <div className="gs-sent-messages">
              {messages.map((message) => (
                <article
                  className="gs-message-card"
                  key={message.id}
                >
                  <div className="gs-message-top">
                    <span className="gs-message-type">
                      {message.message_type === "announcement"
                        ? "📢 Announcement"
                        : "✉️ General Message"}
                    </span>

                    <span
                      className={
                        message.is_read
                          ? "gs-message-status read"
                          : "gs-message-status unread"
                      }
                    >
                      {message.is_read ? "Read" : "Unread"}
                    </span>
                  </div>

                  <h3>{message.title}</h3>

                  <p className="gs-message-content">
                    {message.body}
                  </p>

                  <p>
                    <strong>From:</strong>{" "}
                    {message.sender_name || "GreenSpace Admin"}
                  </p>

                  <p>
                    <strong>Received:</strong>{" "}
                    {message.created_at
                      ? new Date(
                          message.created_at
                        ).toLocaleString()
                      : "Date unavailable"}
                  </p>

                  {!message.is_read && (
                    <button
                      className="gs-action-button gs-primary-button"
                      type="button"
                      disabled={
                        updatingMessageId === message.id
                      }
                      onClick={() =>
                        handleMarkAsRead(message.id)
                      }
                    >
                      {updatingMessageId === message.id
                        ? "Updating..."
                        : "Mark as Read"}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* GreenSpace Projects */}
        <section className="gs-panel" id="projects">
          <div className="gs-panel-header">
            <div>
              <h2>GreenSpace Projects</h2>
              <p>Explore the available GreenSpace projects.</p>
            </div>

            <span className="gs-count">
              {projects.length} projects
            </span>
          </div>

          {/* Admin project form */}
          {isAdmin && (
            <form
              className="gs-project-form"
              onSubmit={handleSave}
            >
              <div className="gs-form-group">
                <label htmlFor="project-name">
                  Project name
                </label>

                <input
                  id="project-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  maxLength={150}
                  required
                />
              </div>

              <div className="gs-form-group">
                <label htmlFor="project-description">
                  Description
                </label>

                <textarea
                  id="project-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                  maxLength={5000}
                />
              </div>

              <div className="gs-form-group">
                <label htmlFor="project-location">
                  Location
                </label>

                <input
                  id="project-location"
                  value={form.location}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      location: event.target.value,
                    })
                  }
                  maxLength={200}
                />
              </div>

              <div className="gs-form-actions">
                <button
                  className="gs-action-button gs-primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Update Project"
                      : "Create Project"}
                </button>

                {editingId !== null && (
                  <button
                    className="gs-action-button gs-secondary-button"
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyProject);
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          )}

          {!isAdmin && (
            <p className="gs-section-description">
              You can view projects. Admin access is required
              to make changes.
            </p>
          )}

          {projects.length === 0 ? (
            <p className="gs-empty">No projects found.</p>
          ) : (
            <div className="gs-sent-messages">
              {projects.map((project) => (
                <article
                  className="gs-project-card"
                  key={project.id}
                >
                  <div className="gs-project-heading">
                    <span className="gs-project-icon">🌱</span>
                    <h3>{project.name}</h3>
                  </div>

                  <p>
                    {project.description || "No description"}
                  </p>

                  <p>
                    <strong>Location:</strong>{" "}
                    {project.location || "Not specified"}
                  </p>

                  {isAdmin && (
                    <div className="gs-dashboard-actions">
                      <button
                        className="gs-action-button gs-primary-button"
                        type="button"
                        onClick={() => handleEdit(project)}
                      >
                        Edit
                      </button>

                      <button
                        className="gs-action-button gs-secondary-button"
                        type="button"
                        onClick={() => handleDelete(project.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="gs-footer">
          🌿 GreenSpace · Account Dashboard
        </footer>
      </main>
    </div>
  );
}
