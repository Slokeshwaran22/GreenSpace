
import "../styles/App.css";

export default function AuthLayout({ title, description, children }) {
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="image-panel">
          <div className="image-overlay">
            <h1>GreenSpace</h1>
            <p>Bring nature closer to your everyday life.</p>
          </div>
        </section>

        <section className="form-panel">
          <div className="auth-card">
            <h2>{title}</h2>
            {description && <p className="auth-description">{description}</p>}
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
