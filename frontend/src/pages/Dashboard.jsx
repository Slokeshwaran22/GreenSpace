
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
  const [form, setForm] = useState(emptyProject);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = profile?.role === "admin";

  const loadProjects = useCallback(async () => {
    const result = await api.listProjects();
    setProjects(result.projects || []);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const result = await api.me();
        if (!active) return;

        setProfile(result.user);

        const projectResult = await api.listProjects();
        if (active) {
          setProjects(projectResult.projects || []);
        }
      } catch (error) {
        if (active) {
          toast.error(error.message || "Unable to load dashboard.");
          navigate("/login", { replace: true });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleCheckRole() {
    try {
      const result = await api.checkRole();
      setProfile(result.user);
      toast.info(`Your role is: ${result.user.role}`);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
      toast.success("Logged out successfully.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error.message || "Logout failed.");
    }
  }

  function handleEdit(project) {
    setEditingId(project.id);
    setForm({
      name: project.name,
      description: project.description || "",
      location: project.location || "",
    });
  }

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

  async function handleDelete(id) {
    if (!window.confirm("Delete this project?")) return;

    try {
      await api.deleteProject(id);
      toast.success("Project deleted.");
      await loadProjects();
    } catch (error) {
      toast.error(error.message || "Unable to delete project.");
    }
  }

  if (loading) return <p>Loading GreenSpace dashboard...</p>;
  if (!profile) return null;

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>GreenSpace Dashboard</h1>
          <p>Welcome, {profile.username}!</p>
        </div>

        <button
          className="secondary-button"
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>

      <section className="dashboard-card">
        <h2>My Profile</h2>
        <p><strong>Name:</strong> {profile.username}</p>
        <p><strong>Email:</strong> {profile.email}</p>
        <p><strong>Phone:</strong> {profile.phone || "Not provided"}</p>
        <p>
          <strong>Role:</strong>{" "}
          {profile.role === "admin" ? "Admin" : "User"}
        </p>

        <button
          className="primary-button"
          onClick={handleCheckRole}
        >
          Check Role
        </button>
      </section>

      <section className="dashboard-card">
        <h2>GreenSpace Projects</h2>

        {isAdmin && (
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label htmlFor="project-name">Project name</label>
              <input
                id="project-name"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                maxLength={150}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="project-description">Description</label>
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

            <div className="form-group">
              <label htmlFor="project-location">Location</label>
              <input
                id="project-location"
                value={form.location}
                onChange={(event) =>
                  setForm({ ...form, location: event.target.value })
                }
                maxLength={200}
              />
            </div>

            <button
              className="primary-button"
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
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyProject);
                }}
              >
                Cancel Edit
              </button>
            )}
          </form>
        )}

        {!isAdmin && (
          <p>You can view projects. Admin access is required to make changes.</p>
        )}

        {projects.length === 0 ? (
          <p>No projects found.</p>
        ) : (
          <div className="projects-list">
            {projects.map((project) => (
              <article className="dashboard-card" key={project.id}>
                <h3>{project.name}</h3>
                <p>{project.description || "No description"}</p>
                <p>
                  <strong>Location:</strong>{" "}
                  {project.location || "Not specified"}
                </p>

                {isAdmin && (
                  <div className="dashboard-actions">
                    <button
                      className="primary-button"
                      onClick={() => handleEdit(project)}
                    >
                      Edit
                    </button>
                    <button
                      className="secondary-button"
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
    </main>
  );
}
