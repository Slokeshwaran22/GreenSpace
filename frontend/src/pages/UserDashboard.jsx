import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../api.js";
import FileManagement from "../components/FileManagement.jsx";
import ProfileEditor from "../components/ProfileEditor.jsx";
import "../styles/UserDashboard.css";

export default function UserDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      const results = await Promise.allSettled([
        api.me(),
        api.listProjects(),
        api.get("/messages/"),
      ]);

      if (!active) return;

      const [profileResult, projectsResult, messagesResult] = results;

      if (profileResult.status === "fulfilled") {
        const response = profileResult.value;

        setUser(
          response?.user ??
            response?.data?.user ??
            response?.data ??
            response
        );
      } else {
        console.error("Profile error:", profileResult.reason);
        toast.error("Unable to load your profile.");
      }

      if (projectsResult.status === "fulfilled") {
        const response = projectsResult.value;

        setProjects(
          Array.isArray(response)
            ? response
            : response?.projects ??
                response?.data?.projects ??
                []
        );
      } else {
        console.error("Projects error:", projectsResult.reason);
      }

      if (messagesResult.status === "fulfilled") {
        const response = messagesResult.value;

        setMessages(
          Array.isArray(response)
            ? response
            : response?.messages ??
                response?.data?.messages ??
                []
        );
      } else {
        console.error("Messages error:", messagesResult.reason);
      }

      setLoading(false);
    }

    loadDashboard().catch((error) => {
      if (active) {
        console.error("Dashboard error:", error);
        toast.error("Unable to load dashboard.");
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await api.logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error(error?.message || "Logout failed.");
    } finally {
      setLoggingOut(false);
    }
  }

  const name =
    user?.name ||
    user?.username ||
    user?.full_name ||
    user?.fullName ||
    "User";

  const email = user?.email || user?.gmail || "Not available";
  const phone = user?.phone || user?.phone_number || "Not available";
  const role = user?.role || "user";

  if (loading) {
    return (
      <main className="user-dashboard user-loading-page">
        <div className="user-loading-spinner" />
        <p>Loading GreenSpace Dashboard...</p>
      </main>
    );
  }

  return (
    <main className="user-dashboard">
      {/* Left Sidebar */}
      <aside className="user-sidebar">
        <a href="#dashboard" className="user-sidebar-brand">
          <span className="user-sidebar-logo">🍃</span>
          <span>GreenSpace</span>
        </a>

        <div className="user-sidebar-label">USER WORKSPACE</div>

        <nav className="user-sidebar-nav" aria-label="User navigation">
          <a className="user-nav-link active" href="#dashboard">
            <span>🏠</span>
            <span>Dashboard</span>
          </a>

          <a className="user-nav-link" href="#profile">
            <span>👤</span>
            <span>My Profile</span>
          </a>

          <a className="user-nav-link" href="#messages">
            <span>✉️</span>
            <span>Messages</span>
            {messages.length > 0 && (
              <span className="user-nav-count">{messages.length}</span>
            )}
          </a>

          <a className="user-nav-link" href="#projects">
            <span>📂</span>
            <span>My Projects</span>
          </a>

          <a className="user-nav-link" href="#file-management">
            <span>📁</span>
            <span>File Management</span>
          </a>
        </nav>

        <div className="user-sidebar-bottom">
          <div className="user-sidebar-account">
            <div className="user-avatar">
              {name.charAt(0).toUpperCase()}
            </div>

            <div className="user-account-info">
              <strong>{name}</strong>
              <span>Standard User</span>
            </div>
          </div>

          <button
            type="button"
            className="user-sidebar-logout"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <span>↪</span>
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>

      {/* Main Dashboard */}
      <div className="user-main">
        <header className="user-topbar">
          <div>
            <span className="user-topbar-label">
              GREENSPACE WORKSPACE
            </span>
            <h1>User Dashboard</h1>
          </div>

          <div className="user-topbar-account">
            <span className="user-online-dot" />
            <span>Welcome, {name}</span>
          </div>
        </header>

        <div className="user-content" id="dashboard">
          {/* Welcome Banner */}
          <section className="user-welcome">
            <div className="user-welcome-text">
              <span className="user-eyebrow">
                YOUR PERSONAL WORKSPACE
              </span>

              <h2>Welcome back, {name}!</h2>

              <p>
                Manage your profile, view messages, explore projects,
                and access your files from one place.
              </p>
            </div>

            <div
              className="user-welcome-decoration"
              aria-hidden="true"
            >
              🍃
            </div>
          </section>

          {/* Summary Cards */}
          <section className="user-summary-grid">
            <a className="user-summary-card" href="#profile">
              <span className="user-summary-icon">👤</span>

              <div>
                <span>Account</span>
                <strong>My Profile</strong>
              </div>

              <span className="user-summary-arrow">↗</span>
            </a>

            <a className="user-summary-card" href="#messages">
              <span className="user-summary-icon">✉️</span>

              <div>
                <span>Updates</span>
                <strong>{messages.length} Messages</strong>
              </div>

              <span className="user-summary-arrow">↗</span>
            </a>

            <a className="user-summary-card" href="#projects">
              <span className="user-summary-icon">📂</span>

              <div>
                <span>Workspace</span>
                <strong>{projects.length} Projects</strong>
              </div>

              <span className="user-summary-arrow">↗</span>
            </a>
          </section>

          {/* Profile - View and Edit */}
          <ProfileEditor />

          {/* Admin Messages */}
          <section className="user-panel" id="messages">
            <div className="user-section-heading">
              <div className="user-heading-icon">✉️</div>

              <div className="user-heading-text">
                <h2>Messages from Admin</h2>
                <p>Stay informed about important updates</p>
              </div>

              <span className="user-count-badge">
                {messages.length}
              </span>
            </div>

            {messages.length ? (
              <div className="user-message-list">
                {messages.map((message, index) => (
                  <article
                    className="user-message-card"
                    key={message.id ?? index}
                  >
                    <div className="user-message-icon">📩</div>

                    <div className="user-message-body">
                      <h3>
                        {message.subject ||
                          message.title ||
                          "Admin Message"}
                      </h3>

                      <p>
                        {message.message ||
                          message.content ||
                          message.body ||
                          "No message content available."}
                      </p>

                      {(message.created_at || message.sent_at) && (
                        <span className="user-message-date">
                          {String(
                            message.created_at || message.sent_at
                          )}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="user-empty">
                <span>💬</span>
                <h3>No messages yet</h3>
                <p>
                  Messages from your administrator will appear here.
                </p>
              </div>
            )}
          </section>

          {/* Projects */}
          <section className="user-panel" id="projects">
            <div className="user-section-heading">
              <div className="user-heading-icon">📂</div>

              <div className="user-heading-text">
                <h2>My Projects</h2>
                <p>Your available projects and activities</p>
              </div>

              <span className="user-count-badge">
                {projects.length}
              </span>
            </div>

            {projects.length ? (
              <div className="user-project-grid">
                {projects.map((project, index) => (
                  <article
                    className="user-project-card"
                    key={project.id ?? index}
                  >
                    <div className="user-project-icon">📁</div>

                    <div className="user-project-body">
                      <h3>
                        {project.name ||
                          project.title ||
                          `Project ${index + 1}`}
                      </h3>

                      <p>
                        {project.description ||
                          "No description available."}
                      </p>

                      {project.status && (
                        <span className="user-project-status">
                          {project.status}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="user-empty">
                <span>🗂️</span>
                <h3>No projects available</h3>
                <p>Your assigned projects will appear here.</p>
              </div>
            )}
          </section>

          {/* File Management */}
          <section className="user-panel" id="file-management">
            <div className="user-section-heading">
              <div className="user-heading-icon">📁</div>

              <div className="user-heading-text">
                <h2>File Management</h2>
                <p>
                  Upload and manage files you are authorized to access.
                </p>
              </div>
            </div>

            <div className="user-file-management-content">
              <FileManagement />
            </div>
          </section>

          {/* Footer */}
          <footer className="user-footer">
            <strong>🍃 GreenSpace</strong>
            <span>Personal workspace · Secure access</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
