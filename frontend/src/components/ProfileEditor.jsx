
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "../api.js";

export default function ProfileEditor() {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadProfile() {
    setLoading(true);

    try {
      const response = await api.get("/profile/me");
      const data =
        response?.user ?? response?.data?.user ?? response?.data ?? response;

      setProfile(data);
      setName(data?.name ?? data?.username ?? "");
      setPhone(data?.phone ?? data?.phone_number ?? "");
    } catch (error) {
      console.error("Profile loading error:", error);
      toast.error(error?.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  function handleCancel() {
    setName(profile?.name ?? profile?.username ?? "");
    setPhone(profile?.phone ?? profile?.phone_number ?? "");
    setEditing(false);
  }

  async function handleSave(event) {
    event.preventDefault();

    if (saving) return;

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (trimmedName.length < 3 || trimmedName.length > 100) {
      toast.error("Name must be between 3 and 100 characters.");
      return;
    }

    if (!/^[0-9]{10}$/.test(trimmedPhone)) {
      toast.error("Phone number must contain exactly 10 digits.");
      return;
    }

    setSaving(true);

    try {
      const response = await api.put("/profile/me", {
        name: trimmedName,
        phone: trimmedPhone,
      });

      const updatedName = response?.name ?? trimmedName;
      const updatedPhone = response?.phone ?? trimmedPhone;

      setProfile((previous) => ({
        ...previous,
        name: updatedName,
        username: updatedName,
        phone: updatedPhone,
        phone_number: updatedPhone,
      }));

      setName(updatedName);
      setPhone(updatedPhone);
      setEditing(false);

      toast.success(
        response?.message || "Profile updated successfully."
      );

      // Refresh from the backend to display the saved database values.
      await loadProfile();
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error(error?.message || "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="user-panel">
        <p>Loading profile...</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="user-panel">
        <h2>My Profile</h2>
        <p>Unable to load your profile. Please refresh and try again.</p>
        <button type="button" onClick={loadProfile}>
          Retry
        </button>
      </section>
    );
  }

  const displayedName = profile.name ?? profile.username ?? "User";
  const displayedEmail = profile.email ?? "Not available";
  const displayedPhone = profile.phone ?? profile.phone_number ?? "Not available";
  const displayedRole = profile.role ?? "user";

  return (
    <section className="user-panel" id="profile">
      <div className="user-section-heading">
        <div className="user-heading-icon">👤</div>

        <div className="user-heading-text">
          <h2>My Profile</h2>
          <p>Your registered account information</p>
        </div>

        {!editing && (
          <button
            type="button"
            className="profile-edit-button"
            onClick={() => setEditing(true)}
          >
            ✏️ Edit Profile
          </button>
        )}
      </div>

      {editing ? (
        <form className="profile-edit-form" onSubmit={handleSave}>
          <div className="profile-field">
            <label htmlFor="profile-name">Full Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={3}
              maxLength={100}
              required
              autoComplete="name"
              disabled={saving}
            />
          </div>

          <div className="profile-field">
            <label htmlFor="profile-phone">Phone Number</label>
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
              }
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              required
              autoComplete="tel"
              disabled={saving}
            />
          </div>

          <div className="profile-edit-actions">
            <button
              type="button"
              className="profile-cancel-button"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="profile-save-button"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="user-profile-grid">
          <div className="user-detail">
            <span className="user-detail-icon">👤</span>
            <div>
              <span className="user-detail-label">Full Name</span>
              <strong>{displayedName}</strong>
            </div>
          </div>

          <div className="user-detail">
            <span className="user-detail-icon">✉️</span>
            <div>
              <span className="user-detail-label">Email Address</span>
              <strong>{displayedEmail}</strong>
            </div>
          </div>

          <div className="user-detail">
            <span className="user-detail-icon">📱</span>
            <div>
              <span className="user-detail-label">Phone Number</span>
              <strong>{displayedPhone}</strong>
            </div>
          </div>

          <div className="user-detail">
            <span className="user-detail-icon">🛡️</span>
            <div>
              <span className="user-detail-label">Account Role</span>
              <strong>{displayedRole}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
