import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import FileManagement from "../components/FileManagement.jsx";
import ProfileEditor from "../components/ProfileEditor.jsx";
import "../styles/AdminDashboard.css";

const API_URL = "http://localhost:8000";
const MAX_EXCEL_FILE_SIZE = 5 * 1024 * 1024;

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  // Excel import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importError, setImportError] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);

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

  // Load sent messages
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

  // Load dashboard and sent messages
  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await api.get("/admin/admindashboard");
        setDashboard(response);
        setError("");
      } catch (err) {
        setError(
          err.message || "Unable to load admin dashboard."
        );
      }
    }

    fetchDashboard();
    fetchSentMessages();
  }, []);

  // Validate a selected Excel file
  function validateExcelFile(file) {
    if (!file) {
      setExcelFile(null);
      return false;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setExcelFile(null);
      setImportError(true);
      setImportStatus("Only .xlsx Excel files are supported.");
      setImportSummary(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return false;
    }

    if (file.size > MAX_EXCEL_FILE_SIZE) {
      setExcelFile(null);
      setImportError(true);
      setImportStatus("The file must be 5 MB or smaller.");
      setImportSummary(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return false;
    }

    setExcelFile(file);
    setImportStatus("");
    setImportError(false);
    setImportSummary(null);

    return true;
  }

  // Handle file selection or drag-and-drop
  function handleExcelFileChange(event) {
    const file = event.target.files?.[0] || null;
    validateExcelFile(file);
  }

  function handleFileDrop(event) {
    event.preventDefault();
    setIsDraggingFile(false);

    if (importing) return;

    const file = event.dataTransfer.files?.[0];

    if (file) {
      validateExcelFile(file);
    }
  }

  // Open Excel import popup
  function openImportModal() {
    setShowImportModal(true);
    setExcelFile(null);
    setImportStatus("");
    setImportError(false);
    setImportSummary(null);
    setIsDraggingFile(false);
  }

  // Close popup and reset form
  function closeImportModal() {
    if (importing) return;

    setShowImportModal(false);
    setExcelFile(null);
    setImportStatus("");
    setImportError(false);
    setImportSummary(null);
    setIsDraggingFile(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Import users from Excel
  async function handleExcelImport(event) {
    event.preventDefault();

    if (importing) return;

    if (!excelFile) {
      setImportError(true);
      setImportStatus("Please select an Excel (.xlsx) file.");
      return;
    }

    if (!excelFile.name.toLowerCase().endsWith(".xlsx")) {
      setImportError(true);
      setImportStatus("Only .xlsx Excel files are supported.");
      return;
    }

    if (excelFile.size > MAX_EXCEL_FILE_SIZE) {
      setImportError(true);
      setImportStatus("The file must be 5 MB or smaller.");
      return;
    }

    setImporting(true);
    setImportStatus("");
    setImportError(false);
    setImportSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", excelFile);

      const response = await fetch(
        `${API_URL}/admin/users/import-excel`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (!response.ok) {
        let errorMessage = "Excel import failed.";

        try {
          const errorData = await response.json();

          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail
              .map((item) => item.msg || "Invalid request")
              .join(", ");
          }
        } catch {
          // Keep default error message.
        }

        if (response.status === 401 || response.status === 403) {
          errorMessage =
            "Admin authentication failed. Please log in as an admin.";
        }

        throw new Error(errorMessage);
      }

      const totalRows = Number(
        response.headers.get("X-Total-Rows") || 0
      );

      const usersCreated = Number(
        response.headers.get("X-Users-Created") || 0
      );

      const usersFailed = Number(
        response.headers.get("X-Users-Failed") || 0
      );

      setImportSummary({
        totalRows,
        usersCreated,
        usersFailed,
      });

      // Download import result workbook
      const resultBlob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(resultBlob);
      const downloadLink = document.createElement("a");

      downloadLink.href = downloadUrl;
      downloadLink.download = "GreenSpace_Import_Results.xlsx";

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
      }, 1000);

      setImportError(usersFailed > 0);

      if (usersFailed === 0) {
        setImportStatus(
          `Import completed successfully! ${usersCreated} user(s) created. Results Excel downloaded.`
        );
      } else if (usersCreated === 0) {
        setImportStatus(
          `Import processed ${totalRows} row(s), but no users were created. Check the downloaded results Excel for the reasons.`
        );
      } else {
        setImportStatus(
          `Import completed with some failures. ${usersCreated} user(s) created and ${usersFailed} row(s) failed. Check the downloaded results Excel.`
        );
      }

      // Refresh dashboard after import
      try {
        const updatedDashboard = await api.get(
          "/admin/admindashboard"
        );
        setDashboard(updatedDashboard);
      } catch (refreshError) {
        console.error(
          "Unable to refresh dashboard:",
          refreshError
        );
      }

      setExcelFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setImportError(true);
      setImportStatus(
        err.message || "Unable to import Excel file."
      );
    } finally {
      setImporting(false);
    }
  }

  // Send a message to one user or all regular users
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

      const result = await api.post("/admin/messages", payload);

      setSendStatus(
        `${result.message} Recipients: ${result.recipient_count}`
      );

      setMessageTitle("");
      setMessageBody("");
      setRecipientId("all");
      setMessageType("general");

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

  // Loading and error states
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

          <a className="gs-nav-link" href="#admin-profile">
            👤 My Profile
          </a>

          <a className="gs-nav-link" href="#users">
            👥 Users
          </a>

          <a
            className="gs-nav-link"
            href="#users"
            onClick={(event) => {
              event.preventDefault();
              openImportModal();
            }}
          >
            📊 Import Users
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

          <a className="gs-nav-link" href="#file-management">
            📁 File Management
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

        {/* Admin Profile Editor */}
        <section id="admin-profile" className="gs-panel">
          <ProfileEditor />
        </section>

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

            <div className="gs-user-actions">
              <span className="gs-count">
                {users.length} users
              </span>

              <button
                type="button"
                className="gs-import-button"
                onClick={openImportModal}
              >
                ☁ Import
              </button>
            </div>
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
                      <td className="gs-user-name">{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.phone || "—"}</td>
                      <td>
                        <span
                          className={`gs-role ${
                            String(user.role).trim().toLowerCase() ===
                            "admin"
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

        {/* Excel import modal */}
        {showImportModal && (
          <div
            className="gs-modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                !importing
              ) {
                closeImportModal();
              }
            }}
          >
            <div
              className="gs-import-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="gs-import-title"
            >
              <div className="gs-import-modal-header">
                <div className="gs-import-modal-title">
                  <span className="gs-import-modal-icon">↑</span>
                  <h2 id="gs-import-title">
                    Import User Session
                  </h2>
                </div>

                <button
                  type="button"
                  className="gs-modal-close"
                  onClick={closeImportModal}
                  disabled={importing}
                  aria-label="Close popup"
                >
                  ×
                </button>
              </div>

              <div className="gs-import-modal-body">
                <p>
                  Upload an Excel file to import multiple users into
                  GreenSpace.
                </p>

                <form onSubmit={handleExcelImport}>
                  {/* Single Download Template button */}
                  <a
                    className="gs-template-button gs-template-button-single"
                    href="/GreenSpace_User_Import_Template.xlsx"
                    download="GreenSpace_User_Import_Template.xlsx"
                  >
                    <span aria-hidden="true">↓</span>
                    Download Template
                  </a>

                  {/* Excel file chooser */}
                  <div className="gs-form-group gs-excel-upload-group">
                    <label htmlFor="gs-excel-file">
                      Choose Excel File (.xlsx) *
                    </label>

                    <div
                      className={`gs-excel-dropzone ${
                        isDraggingFile ? "is-dragging" : ""
                      } ${excelFile ? "has-file" : ""}`}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        if (!importing) setIsDraggingFile(true);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!importing) setIsDraggingFile(true);
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault();

                        if (
                          !event.currentTarget.contains(
                            event.relatedTarget
                          )
                        ) {
                          setIsDraggingFile(false);
                        }
                      }}
                      onDrop={handleFileDrop}
                    >
                      <span
                        className="gs-excel-upload-icon"
                        aria-hidden="true"
                      >
                        ↑
                      </span>

                      <strong>
                        Drag &amp; drop your Excel file here
                      </strong>

                      <span className="gs-excel-dropzone-or">
                        or
                      </span>

                      <button
                        type="button"
                        className="gs-browse-files-button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                      >
                        Browse Files
                      </button>

                      <input
                        ref={fileInputRef}
                        id="gs-excel-file"
                        className="gs-hidden-file-input"
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={handleExcelFileChange}
                        disabled={importing}
                        aria-label="Choose Excel file"
                      />

                      <small className="gs-excel-file-name">
                        {excelFile
                          ? excelFile.name
                          : "No file chosen"}
                      </small>
                    </div>

                    <small className="gs-excel-file-hint">
                      .xlsx files only · Maximum size 5 MB
                    </small>
                  </div>

                  {importStatus && (
                    <p
                      role="status"
                      aria-live="polite"
                      className={
                        importError
                          ? "gs-import-status error"
                          : "gs-import-status success"
                      }
                    >
                      {importStatus}
                    </p>
                  )}

                  {importSummary && (
                    <div className="gs-import-summary">
                      <div>
                        <span>Total rows</span>
                        <strong>{importSummary.totalRows}</strong>
                      </div>

                      <div>
                        <span>Created</span>
                        <strong>{importSummary.usersCreated}</strong>
                      </div>

                      <div>
                        <span>Failed</span>
                        <strong>{importSummary.usersFailed}</strong>
                      </div>
                    </div>
                  )}

                  <div className="gs-import-modal-footer">
                    <button
                      type="button"
                      className="gs-modal-cancel"
                      onClick={closeImportModal}
                      disabled={importing}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="gs-import-button gs-import-submit-button"
                      disabled={importing || !excelFile}
                    >
                      {importing
                        ? "Importing..."
                        : "↑ Upload & Import Users"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Send messages */}
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
            <div className="gs-form-group">
              <label htmlFor="message-recipient">Recipient</label>

              <select
                id="message-recipient"
                value={recipientId}
                onChange={(event) =>
                  setRecipientId(event.target.value)
                }
                required
              >
                <option value="all">All regular users</option>

                {regularUsers.map((user) => (
                  <option key={user.id} value={String(user.id)}>
                    {user.name} — {user.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="gs-form-group">
              <label htmlFor="message-type">Message Type</label>

              <select
                id="message-type"
                value={messageType}
                onChange={(event) =>
                  setMessageType(event.target.value)
                }
                required
              >
                <option value="general">General Message</option>
                <option value="announcement">Announcement</option>
              </select>
            </div>

            <div className="gs-form-group">
              <label htmlFor="message-title">Title</label>

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

            <div className="gs-form-group">
              <label htmlFor="message-body">Message</label>

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
              <p>Messages sent by the administrator</p>
            </div>

            <span className="gs-count">
              {sentMessages.length} messages
            </span>
          </div>

          {messagesLoading ? (
            <p className="gs-empty">Loading sent messages...</p>
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
            <p className="gs-empty">No messages sent yet.</p>
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
                      : message.recipient_names || "Selected user"}
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
              <p>User activity history</p>
            </div>
          </div>

          <p className="gs-empty">
            Activity history is not connected yet. Login/logout
            events need to be recorded by the backend before they
            can appear here.
          </p>
        </section>

        {/* File Management */}
        <section className="gs-panel" id="file-management">
          <FileManagement />
        </section>

        {/* Footer */}
        <footer className="gs-footer">
          GreenSpace · Together for a Greener Tomorrow
        </footer>
      </main>
    </div>
  );
}
