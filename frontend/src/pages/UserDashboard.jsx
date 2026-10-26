import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../api.js";
import FileManagement from "../components/FileManagement.jsx";
import ProfileEditor from "../components/ProfileEditor.jsx";
import "../styles/UserDashboard.css";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "profile", label: "My Profile", icon: "user" },
  { id: "messages", label: "Messages", icon: "mail" },
  { id: "file-management", label: "File Management", icon: "folder" },
];

// Simple line icons used across the dashboard
const ICON_PATHS = {
  home: (
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  folder: (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  ),
  logout: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19C5 11 10 5 20 4c-1 10-7 15-15 15z" />
      <path d="M5 19 14 10" />
    </>
  ),
};

function Icon({ name, className = "" }) {
  return (
    <svg
      className={`ud-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// One leaf shape, reused at different sizes and angles
const LEAF_PATH = "M0 0C28-34 92-38 132 0C92 38 28 34 0 0Z";

function Leaf({ x, y, scale, rotate, fill }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d={LEAF_PATH} fill={fill} />
      <path
        d="M4 0C40-2 90-2 128 0"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="2"
        fill="none"
      />
    </g>
  );
}

// Leaf artwork on the right side of the welcome banner
function HeroLeaves() {
  return (
    <svg
      className="ud-hero-leaves"
      viewBox="0 0 420 240"
      preserveAspectRatio="xMaxYMax meet"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ud-hero-glow" cx="70%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#f6ffe8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f6ffe8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ud-leaf-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8fd16a" />
          <stop offset="100%" stopColor="#2f8f3e" />
        </linearGradient>
        <linearGradient id="ud-leaf-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5bb04a" />
          <stop offset="100%" stopColor="#1d6b34" />
        </linearGradient>
        <linearGradient id="ud-leaf-c" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b9e58e" />
          <stop offset="100%" stopColor="#4ea047" />
        </linearGradient>
      </defs>

      <circle cx="300" cy="90" r="150" fill="url(#ud-hero-glow)" />
      <path
        d="M250 250C262 190 290 140 340 96"
        stroke="#3f8a3c"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M330 250C328 200 340 150 372 112"
        stroke="#3f8a3c"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <Leaf x={258} y={196} scale={0.9} rotate={-150} fill="url(#ud-leaf-b)" />
      <Leaf x={276} y={160} scale={1.05} rotate={-28} fill="url(#ud-leaf-a)" />
      <Leaf x={300} y={124} scale={0.95} rotate={-118} fill="url(#ud-leaf-b)" />
      <Leaf x={338} y={100} scale={0.8} rotate={-62} fill="url(#ud-leaf-c)" />
      <Leaf x={336} y={196} scale={0.75} rotate={-12} fill="url(#ud-leaf-a)" />
      <Leaf x={352} y={150} scale={0.7} rotate={-150} fill="url(#ud-leaf-c)" />
      <Leaf x={372} y={114} scale={0.55} rotate={-40} fill="url(#ud-leaf-b)" />
    </svg>
  );
}

export default function UserDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      const results = await Promise.allSettled([
        api.me(),
        api.get("/messages/"),
      ]);

      if (!active) return;

      const [profileResult, messagesResult] = results;

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

  if (loading) {
    return (
      <main className="ud-loading">
        <div className="ud-loading-spinner" />
        <p>Loading GreenSpace Dashboard...</p>
      </main>
    );
  }

  return (
    <div className="ud">
      {/* Left Sidebar */}
      <aside className="ud-sidebar">
        <a
          href="#dashboard"
          className="ud-brand"
          onClick={() => setActiveSection("dashboard")}
        >
          <span className="ud-brand-logo">
            <Icon name="leaf" />
          </span>
          <span>GreenSpace</span>
        </a>

        <div className="ud-sidebar-label">USER WORKSPACE</div>

        <nav className="ud-nav" aria-label="User navigation">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`ud-nav-link ${
                activeSection === item.id ? "is-active" : ""
              }`}
              aria-current={activeSection === item.id ? "true" : undefined}
              onClick={() => setActiveSection(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>

              {item.id === "messages" && messages.length > 0 && (
                <span className="ud-nav-badge">{messages.length}</span>
              )}
            </a>
          ))}
        </nav>

        <div className="ud-sidebar-bottom">
          <div className="ud-sidebar-account">
            <div className="ud-avatar">{name.charAt(0).toUpperCase()}</div>

            <div className="ud-account-info">
              <strong>{name}</strong>
              <span>Standard User</span>
            </div>
          </div>

          <button
            type="button"
            className="ud-nav-link ud-logout"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <Icon name="logout" />
            <span>{loggingOut ? "Logging out..." : "Logout"}</span>
          </button>
        </div>
      </aside>

      {/* Main Dashboard */}
      <main className="ud-main" id="dashboard">
        <header className="ud-topbar">
          <div>
            <p className="ud-eyebrow">GREENSPACE WORKSPACE</p>
            <h1>User Dashboard</h1>
          </div>

          <div className="ud-welcome-pill">
            <span className="ud-pill-avatar">
              <Icon name="user" />
            </span>
            <span className="ud-online-dot" />
            <span>Welcome, {name}</span>
          </div>
        </header>

        {/* Welcome Banner */}
        <section className="ud-hero">
          <div className="ud-hero-text">
            <p className="ud-eyebrow">YOUR PERSONAL WORKSPACE</p>
            <h2>
              Welcome back, {name}!{" "}
              <Icon name="leaf" className="ud-hero-leaf-icon" />
            </h2>
            <p>
              Manage your profile, view messages, and access your
              files from one place.
            </p>
          </div>

          <HeroLeaves />
        </section>

        {/* Summary Cards */}
        <section className="ud-summary-grid">
          <a
            className="ud-summary-card"
            href="#profile"
            onClick={() => setActiveSection("profile")}
          >
            <span className="ud-summary-icon">
              <Icon name="user" />
            </span>

            <span className="ud-summary-text">
              <span>Account</span>
              <strong>My Profile</strong>
            </span>

            <Icon name="arrow" className="ud-summary-arrow" />
          </a>

          <a
            className="ud-summary-card"
            href="#messages"
            onClick={() => setActiveSection("messages")}
          >
            <span className="ud-summary-icon">
              <Icon name="mail" />
            </span>

            <span className="ud-summary-text">
              <span>Updates</span>
              <strong>{messages.length} Messages</strong>
            </span>

            <Icon name="arrow" className="ud-summary-arrow" />
          </a>
        </section>

        {/* Profile and Admin Messages */}
        <div className="ud-content-grid">
          <div className="ud-profile">
            <ProfileEditor />
          </div>

          <section className="ud-card ud-messages" id="messages">
            <div className="ud-card-header">
              <span className="ud-card-icon">
                <Icon name="mail" />
              </span>

              <div className="ud-card-title">
                <h2>Messages from Admin</h2>
                <p>Stay informed about important updates</p>
              </div>

              <span className="ud-count-badge">{messages.length}</span>
            </div>

            {messages.length ? (
              <ul className="ud-message-list">
                {messages.map((message, index) => (
                  <li className="ud-message" key={message.id ?? index}>
                    <span className="ud-message-icon">
                      <Icon name="mail" />
                    </span>

                    <div className="ud-message-body">
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
                        <span className="ud-message-date">
                          {String(message.created_at || message.sent_at)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ud-empty">
                <span className="ud-empty-art">
                  <Icon name="mail" />
                </span>
                <strong>No messages yet</strong>
                <span>
                  Messages from your administrator will appear here.
                </span>
              </div>
            )}
          </section>
        </div>

        {/* File Management */}
        <section className="ud-card ud-file-section" id="file-management">
          <div className="ud-card-header">
            <span className="ud-card-icon">
              <Icon name="folder" />
            </span>

            <div className="ud-card-title">
              <h2>File Management</h2>
              <p>Upload and manage files you are authorized to access.</p>
            </div>
          </div>

          <div className="ud-file-content">
            <FileManagement />
          </div>
        </section>

        {/* Footer */}
        <footer className="ud-footer">
          <strong>
            <Icon name="leaf" /> GreenSpace
          </strong>
          <span>Personal workspace · Secure access</span>
        </footer>
      </main>
    </div>
  );
}
