import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-card glass-panel">
        <p className="eyebrow">Open Brain</p>
        <h1 className="login-title">Personal task dashboard</h1>
        <p className="meta-text">
          Enter the shared passcode to unlock the current task view. Database access stays server-side.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
