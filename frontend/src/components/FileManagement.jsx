
import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import "./FileManagement.css";

const EMPTY_FILTERS = {
  search: "",
  uploader: "",
  file_type: "",
  date_from: "",
  date_to: "",
};

function formatSize(bytes) {
  const size = Number(bytes || 0);

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
}

function openFile(url) {
  // Same-origin credentials are included by the browser when available.
  // The backend must authenticate the request using its session cookie.
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function FileManagement() {
  const [files, setFiles] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadFiles = useCallback(async (activeFilters = filters) => {
    setLoading(true);
    setError("");

    try {
      const [fileResponse, userResponse] = await Promise.all([
        api.listFiles(activeFilters),
        api.me(),
      ]);

      setFiles(fileResponse.files || []);

      // Adjust if your /me endpoint uses a different response shape.
      setCurrentUser(userResponse.user || userResponse);
    } catch (err) {
      setError(err.message || "Unable to load files.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFiles(EMPTY_FILTERS);
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeFilter(event) {
    const { name, value } = event.target;

    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSearch(event) {
    event.preventDefault();
    setNotice("");
    await loadFiles(filters);
  }

  async function handleReset() {
    setFilters(EMPTY_FILTERS);
    setNotice("");
    await loadFiles(EMPTY_FILTERS);
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Please select a file to upload.");
      return;
    }

    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".xlsx"];
    const filename = selectedFile.name.toLowerCase();
    const allowed = allowedExtensions.some((extension) =>
      filename.endsWith(extension)
    );

    if (!allowed) {
      setError("Allowed file types: PDF, PNG, JPG, JPEG and XLSX.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("The maximum file size is 10 MB.");
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");

    try {
      const result = await api.uploadFile(selectedFile);

      setSelectedFile(null);
      event.target.reset();

      setNotice(result.message || "File uploaded successfully.");
      await loadFiles(filters);
    } catch (err) {
      setError(err.message || "File upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file) {
    const confirmed = window.confirm(
      `Delete "${file.filename || file.original_filename}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(file.id);
    setError("");
    setNotice("");

    try {
      const result = await api.deleteFile(file.id);
      setNotice(result.message || "File deleted successfully.");
      await loadFiles(filters);
    } catch (err) {
      setError(err.message || "Unable to delete file.");
    } finally {
      setDeletingId(null);
    }
  }

  const role = String(currentUser?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const currentUserId = Number(
    currentUser?.id ?? currentUser?.user_id
  );

  function canDelete(file) {
    return (
      isAdmin ||
      (Number.isFinite(currentUserId) &&
        Number(file.uploaded_by) === currentUserId)
    );
  }

  return (
    <section className="fm-page" id="files">
      <header className="fm-heading">
        <div>
          <p className="fm-eyebrow">GREENSPACE WORKSPACE</p>
          <h2>File Management</h2>
          <p></p>
        </div>

        <div className="fm-total">
          <span>{files.length}</span>
          <small>Files shown</small>
        </div>
      </header>

      {error && (
        <div className="fm-alert fm-alert-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="fm-alert fm-alert-success" role="status">
          {notice}
        </div>
      )}

      <section className="fm-card">
        <div className="fm-card-heading">
          <div>
            <h3>Upload a file</h3>
            <p>PDF, PNG, JPG, JPEG or XLSX · Maximum 10 MB</p>
          </div>
          <span className="fm-upload-icon">↑</span>
        </div>

        <form className="fm-upload-form" onSubmit={handleUpload}>
          <input
            aria-label="Choose a file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.xlsx"
            onChange={(event) =>
              setSelectedFile(event.target.files?.[0] || null)
            }
            disabled={uploading}
          />

          {selectedFile && (
            <p className="fm-selected-file">
              Selected: {selectedFile.name} ({formatSize(selectedFile.size)})
            </p>
          )}

          <button className="fm-button fm-button-primary" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        </form>
      </section>

      <section className="fm-card">
        <div className="fm-card-heading">
          <div>
            <h3>Search and filter</h3>
            <p>Find files by name, uploader, type or date.</p>
          </div>
        </div>

        <form className="fm-filter-form" onSubmit={handleSearch}>
          <label>
            Filename
            <input
              name="search"
              value={filters.search}
              onChange={changeFilter}
              placeholder="Search filename..."
            />
          </label>

          <label>
            Uploader name or email
            <input
              name="uploader"
              value={filters.uploader}
              onChange={changeFilter}
              placeholder="Name or email..."
            />
          </label>

          
            

          <div className="fm-filter-actions">
            <button className="fm-button fm-button-primary" type="submit">
              Search
            </button>
            <button
              className="fm-button fm-button-secondary"
              type="button"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="fm-card">
        <div className="fm-card-heading">
          <div>
            <h3>Shared files</h3>
            <p>All files available to your account.</p>
          </div>

          <button
            className="fm-button fm-button-secondary"
            type="button"
            onClick={() => loadFiles(filters)}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p className="fm-empty">Loading files...</p>
        ) : files.length === 0 ? (
          <div className="fm-empty">
            <span className="fm-empty-icon">▤</span>
            <h4>No files found</h4>
            <p>Upload a file or change your search filters.</p>
          </div>
        ) : (
          <div className="fm-table-wrap">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded by</th>
                  <th>Upload date</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <div className="fm-file-name">
                        <span className="fm-file-icon">▤</span>
                        <span>{file.filename || file.original_filename}</span>
                      </div>
                    </td>

                    <td>
                      <span className="fm-type">
                        {String(file.file_type || "").toUpperCase()}
                      </span>
                    </td>

                    <td>{formatSize(file.file_size)}</td>

                    <td>
                      <div className="fm-uploader">
                        <strong>{file.uploader_name || "Unknown user"}</strong>
                        <small>{file.uploader_email || "—"}</small>
                      </div>
                    </td>

                    <td>{formatDate(file.uploaded_at)}</td>

                    <td>
                      <div className="fm-actions">
                        <button
                          type="button"
                          className="fm-action"
                          onClick={() =>
                            openFile(api.fileViewUrl(file.id))
                          }
                        >
                          View
                        </button>

                        <button
                          type="button"
                          className="fm-action"
                          onClick={() =>
                            openFile(api.fileDownloadUrl(file.id))
                          }
                        >
                          Download
                        </button>

                        {canDelete(file) && (
                          <button
                            type="button"
                            className="fm-action fm-action-delete"
                            onClick={() => handleDelete(file)}
                            disabled={deletingId === file.id}
                          >
                            {deletingId === file.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
