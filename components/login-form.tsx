"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ passcode }),
    });

    const body = (await response.json()) as { ok: boolean; error?: string };

    if (!response.ok || !body.ok) {
      setError(body.error === "INVALID_PASSCODE" ? "Incorrect passcode." : "Unable to start session.");
      return;
    }

    startTransition(() => {
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label htmlFor="passcode">Passcode</label>
      <input
        id="passcode"
        className="passcode-input"
        type="password"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        autoComplete="current-password"
        required
      />
      <p className="field-hint">The session cookie lasts 30 days unless you log out sooner.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <button className="primary-button" type="submit" disabled={isPending}>
        {isPending ? "Unlocking..." : "Unlock dashboard"}
      </button>
    </form>
  );
}
