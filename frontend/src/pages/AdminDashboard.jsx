
import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await api.get("/admin/admindashboard");
        setDashboard(response.data);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
          "Unable to load admin dashboard."
        );
      }
    }

    fetchDashboard();
  }, []);

  if (error) return <p>{error}</p>;
  if (!dashboard) return <p>Loading dashboard...</p>;

  return (
    <div>
      <h1>Admin Dashboard</h1>

      <h3>
        Total Registered Users: {dashboard.total_registered_users}
      </h3>

      <h3>
        Currently Logged In: {dashboard.currently_logged_in}
      </h3>

      <h2>Registered Users</h2>

      <table border="1" cellPadding="10">
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
          {dashboard.users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.phone}</td>
              <td>{user.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

