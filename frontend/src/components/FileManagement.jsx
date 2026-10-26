
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import "./FileManagement.css";

const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".xlsx"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

function getExtension(filename) {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index).toLowerCase();
}

// Return an error message for an invalid file, or an empty string.
function validateFile(file) {
  if (!ALLOWED_EXTENSIONS.includes(getExtension(file.name))) {
    return "Only PDF, PNG, JPG, JPEG and XLSX files can be uploaded.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return `This file is ${formatSize(file.size)}. Choose a file of 10 MB or less.`;
  }

  if (file.size === 0) {
    return "This file is empty. Choose another file.";
  }

  return "";
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
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
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

  // Select a file from the picker or a drop, and check it straight away
  function chooseFile(file) {
    if (!file || uploading) return;

    setSelectedFile(file);
    setFileError(validateFile(file));
    setError("");
    setNotice("");
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setFileError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openFilePicker() {
    if (fileInputRef.current) {
      // Allow choosing the same file again after removing it
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (!uploading) setIsDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();

    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedFile) {
      setFileError("Choose a file to upload.");
      return;
    }

    const validationError = validateFile(selectedFile);

    if (validationError) {
      setFileError(validationError);
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");

    try {
      const result = await api.uploadFile(selectedFile);

      clearSelectedFile();

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
            <p>Share a document or image with your team.</p>
          </div>
        </div>

        <form className="fm-upload-form" onSubmit={handleUpload}>
          <input
            ref={fileInputRef}
            id="fm-file-input"
            className="fm-hidden-input"
            aria-label="Choose a file"
            type="file"
            accept={ALLOWED_EXTENSIONS.join(",")}
            onChange={(event) => chooseFile(event.target.files?.[0])}
            disabled={uploading}
            tabIndex={-1}
          />

          {!selectedFile ? (
            <div
              className={`fm-dropzone ${isDragging ? "is-dragging" : ""}`}
              onDragEnter={handleDragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <span className="fm-drop-icon" aria-hidden="true">
                {isDragging ? "↓" : "↑"}
              </span>

              <div className="fm-drop-text">
                <strong>
                  {isDragging
                    ? "Drop to add this file"
                    : "Drag and drop a file here"}
                </strong>

                {isDragging ? (
                  <span className="fm-drop-hint">
                    Release the mouse button to select it
                  </span>
                ) : (
                  <div className="fm-type-chips">
                    {ALLOWED_EXTENSIONS.map((extension) => (
                      <span className="fm-type" key={extension}>
                        {extension.slice(1).toUpperCase()}
                      </span>
                    ))}
                    <span className="fm-drop-hint">Max 10 MB</span>
                  </div>
                )}
              </div>

              {!isDragging && (
                <button
                  type="button"
                  className="fm-browse-button"
                  onClick={openFilePicker}
                  disabled={uploading}
                >
                  Browse files
                </button>
              )}
            </div>
          ) : (
            <div
              className={`fm-chosen-file ${fileError ? "has-error" : ""}`}
            >
              <span className="fm-chosen-type">
                {getExtension(selectedFile.name).slice(1).toUpperCase() ||
                  "FILE"}
              </span>

              <div className="fm-chosen-meta">
                <strong>{selectedFile.name}</strong>
                <span>
                  {formatSize(selectedFile.size)} ·{" "}
                  {uploading
                    ? "uploading..."
                    : fileError
                      ? "cannot be uploaded"
                      : "ready to upload"}
                </span>
              </div>

              <button
                type="button"
                className="fm-remove-button"
                onClick={clearSelectedFile}
                disabled={uploading}
                aria-label="Remove file"
                title="Remove file"
              >
                ×
              </button>
            </div>
          )}

          {fileError && (
            <div className="fm-alert fm-alert-error" role="alert">
              {fileError}
            </div>
          )}

          {selectedFile && (
            <div className="fm-upload-actions">
              <button
                type="button"
                className="fm-change-button"
                onClick={openFilePicker}
                disabled={uploading}
              >
                Choose a different file
              </button>

              <button
                type="submit"
                className="fm-button fm-button-primary"
                disabled={uploading || Boolean(fileError)}
              >
                {uploading ? "Uploading..." : "↑ Upload file"}
              </button>
            </div>
          )}
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
