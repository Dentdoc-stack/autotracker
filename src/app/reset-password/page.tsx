"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
export default function ResetPassword() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const password = new FormData(e.currentTarget).get("password");
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "password", password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update password");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Set your password</h1>
        <form onSubmit={submit}>
          <label className="field">
            <span>New password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <button className="button primary" disabled={busy}>
            Save password
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  );
}
