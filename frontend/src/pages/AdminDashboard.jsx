
import { useEffect, useState } from "react";
import { api } from "../api.js";
import "../styles/Dashboard.css";

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  // Message form states
  const [recipientId, setRecipientId] = useState("all");
  const [messageType, setMessageType] = useState("general");
  const [messageTitle, setMessageTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");
  const [sendError, setSendError] = useState(false);

  // Sent messages states
  const [sentMessages, setSentMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState("");

  // Load sent messages from the backend
  async function fetchSentMessages() {
    setMessagesLoading(true);

    try {
      const response = await api.get("/admin/messages");

      setSentMessages(response.messages || []);
      setMessagesError("");
    } catch (err) {
      setMessagesError(
        err.message || "Unable to load sent messages."
      );
    } finally {
      setMessagesLoading(false);
    }
  }

  // Load admin dashboard and sent messages
  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await api.get("/admin/admindashboard");
        setDashboard(response);
      } catch (err) {
        setError(
          err.message || "Unable to load admin dashboard."
        );
      }
    }

    fetchDashboard();
    fetchSentMessages();
  }, []);

  // Send message to one user or all users
  async function handleSendMessage(event) {
    event.preventDefault();

    if (sending) return;

    if (!messageTitle.trim() || !messageBody.trim()) {
      setSendError(true);
      setSendStatus("Please enter both the title and message.");
      return;
    }

    setSending(true);
    setSendStatus("");
    setSendError(false);

    try {
      const payload = {
        recipient_id:
          recipientId === "all" ? null : Number(recipientId),
        message_type: messageType,
        title: messageTitle.trim(),
        body: messageBody.trim(),
      };

      const result = await api.post(
        "/admin/messages",
        payload
      );

      setSendStatus(
        `${result.message} Recipients: ${result.recipient_count}`
      );

      // Clear form only after successful sending
      setMessageTitle("");
      setMessageBody("");
      setRecipientId("all");
      setMessageType("general");

      // Refresh the saved messages list
      await fetchSentMessages();
    } catch (err) {
      setSendError(true);
      setSendStatus(
        err.message || "Unable to send the message."
      );
    } finally {
      setSending(false);
    }
  }

  // Logout admin
  async function handleLogout() {
    try {
      await api.logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      window.location.href = "/login";
    }
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Unable to load admin dashboard</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="dashboard-loading">
        Loading dashboard...
      </div>
    );
  }

  const users = dashboard.users || [];

  const regularUsers = users.filter(
    (user) =>
      String(user.role).trim().toLowerCase() === "user"
  );

  return (
    <div className="gs-dashboard">
      {/* Sidebar */}
      <aside className="gs-sidebar">
        <h2 className="gs-brand">🍃 GreenSpace</h2>

        <nav className="gs-navigation">
          <a className="gs-nav-link active" href="#dashboard">
            🏠 Dashboard
          </a>

          <a className="gs-nav-link" href="#users">
            👥 Users
          </a>

          <a className="gs-nav-link" href="#messages">
            ✉️ Send Messages
          </a>

          <a className="gs-nav-link" href="#sent-messages">
            📩 Sent Messages
          </a>

          <a className="gs-nav-link" href="#activities">
            ◷ Activities
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

      {/* Main dashboard */}
      <main className="gs-main" id="dashboard">
        {/* Header */}
        <header className="gs-header">
          <div>
            <p className="gs-eyebrow">
              GREENSPACE ADMINISTRATION
            </p>

            <h1>Admin Dashboard</h1>

            <p className="gs-subtitle">
              Welcome back! Here's your platform overview.
            </p>
          </div>

          <div className="gs-admin-label">
            <span className="gs-avatar">A</span>

            <div>
              <strong>Admin</strong>
              <small>Administrator</small>
            </div>
          </div>
        </header>

        {/* Statistics */}
        <section className="gs-stat-grid">
          <article className="gs-stat-card">
            <span className="gs-stat-icon">👥</span>

            <div>
              <p>Total Registered Users</p>
              <h2>
                {dashboard.total_registered_users ?? users.length}
              </h2>
            </div>
          </article>

          <article className="gs-stat-card">
            <span className="gs-stat-icon">🟢</span>

            <div>
              <p>Currently Logged In</p>
              <h2>{dashboard.currently_logged_in ?? 0}</h2>
            </div>
          </article>

          <article className="gs-stat-card">
            <span className="gs-stat-icon">📩</span>

            <div>
              <p>Sent Messages</p>
              <h2>{sentMessages.length}</h2>
            </div>
          </article>
        </section>

        {/* Registered users */}
        <section className="gs-panel" id="users">
          <div className="gs-panel-header">
            <div>
              <h2>Registered Users</h2>
              <p>Accounts registered on GreenSpace</p>
            </div>

            <span className="gs-count">
              {users.length} users
            </span>
          </div>

          {users.length === 0 ? (
            <p className="gs-empty">
              No registered users found.
            </p>
          ) : (
            <div className="gs-table-wrapper">
              <table className="gs-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td className="gs-user-name">
                        {user.name}
                      </td>
                      <td>{user.email}</td>
                      <td>{user.phone || "—"}</td>
                      <td>
                        <span
                          className={`gs-role ${
                            String(user.role)
                              .trim()
                              .toLowerCase() === "admin"
                              ? "gs-role-admin"
                              : "gs-role-user"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Admin messaging form */}
        <section className="gs-panel" id="messages">
          <div className="gs-panel-header">
            <div>
              <h2>Send a Message</h2>
              <p>
                Send announcements or general messages to
                GreenSpace users.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSendMessage}
            className="gs-message-form"
          >
            {/* Recipient */}
            <div className="gs-form-group">
              <label htmlFor="message-recipient">
                Recipient
              </label>

              <select
                id="message-recipient"
                value={recipientId}
                onChange={(event) =>
                  setRecipientId(event.target.value)
                }
                required
              >
                <option value="all">
                  All regular users
                </option>

                {regularUsers.map((user) => (
                  <option
                    key={user.id}
                    value={String(user.id)}
                  >
                    {user.name} — {user.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Message type */}
            <div className="gs-form-group">
              <label htmlFor="message-type">
                Message Type
              </label>

              <select
                id="message-type"
                value={messageType}
                onChange={(event) =>
                  setMessageType(event.target.value)
                }
                required
              >
                <option value="general">
                  General Message
                </option>

                <option value="announcement">
                  Announcement
                </option>
              </select>
            </div>

            {/* Title */}
            <div className="gs-form-group">
              <label htmlFor="message-title">
                Title
              </label>

              <input
                id="message-title"
                type="text"
                value={messageTitle}
                onChange={(event) =>
                  setMessageTitle(event.target.value)
                }
                placeholder="Enter message title"
                maxLength={200}
                required
              />
            </div>

            {/* Message body */}
            <div className="gs-form-group">
              <label htmlFor="message-body">
                Message
              </label>

              <textarea
                id="message-body"
                value={messageBody}
                onChange={(event) =>
                  setMessageBody(event.target.value)
                }
                placeholder="Write your message here..."
                maxLength={10000}
                rows={5}
                required
              />
            </div>

            {/* Success or error message */}
            {sendStatus && (
              <p
                role="status"
                aria-live="polite"
                style={{
                  color: sendError ? "#dc2626" : "#15803d",
                }}
              >
                {sendStatus}
              </p>
            )}

            <button
              className="gs-logout"
              type="submit"
              disabled={sending}
            >
              {sending ? "Sending..." : "Send Message"}
            </button>
          </form>
        </section>

        {/* Sent messages */}
        <section className="gs-panel" id="sent-messages">
          <div className="gs-panel-header">
            <div>
              <h2>Sent Messages</h2>
              <p>
                Messages sent by the administrator
              </p>
            </div>

            <span className="gs-count">
              {sentMessages.length} messages
            </span>
          </div>

          {messagesLoading ? (
            <p className="gs-empty">
              Loading sent messages...
            </p>
          ) : messagesError ? (
            <div>
              <p className="gs-empty" role="alert">
                {messagesError}
              </p>

              <button
                type="button"
                className="gs-logout"
                onClick={fetchSentMessages}
              >
                Retry
              </button>
            </div>
          ) : sentMessages.length === 0 ? (
            <p className="gs-empty">
              No messages sent yet.
            </p>
          ) : (
            <div className="gs-sent-messages">
              {sentMessages.map((message) => (
                <article
                  className="gs-sent-message"
                  key={message.id}
                >
                  <div className="gs-panel-header">
                    <h3>{message.title}</h3>

                    <span className="gs-role">
                      {message.message_type === "announcement"
                        ? "Announcement"
                        : "General"}
                    </span>
                  </div>

                  <p className="gs-message-content">
                    {message.body}
                  </p>

                  <p className="gs-subtitle">
                    Recipients:{" "}
                    {message.recipient_id === null
                      ? "All regular users"
                      : message.recipient_names ||
                        "Selected user"}
                    {" · "}
                    {message.recipient_count} user(s)
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Recent activities */}
        <section className="gs-panel" id="activities">
          <div className="gs-panel-header">
            <div>
              <h2>Recent Activities</h2>
              <p>
                User activity history
              </p>
            </div>
          </div>

          <p className="gs-empty">
            Activity history is not connected yet.
            Login/logout events need to be recorded by the
            backend before they can appear here.
          </p>
        </section>

        {/* Footer */}
        <footer className="gs-footer">
          GreenSpace · Together for a Greener Tomorrow
        </footer>
      </main>
    </div>
  );
}
