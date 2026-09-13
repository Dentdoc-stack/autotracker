"use client";
import { useState, type FormEvent } from "react";
export default function InvitePanel({ demo }: { demo: boolean }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(body.message);
      form.reset();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Invitation failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-card">
      <h2>Invite office staff</h2>
      <p>App accounts are separate from WhatsApp recipients.</p>
      {demo ? (
        <div className="info-box">
          Connect Supabase to send invitations. No emails are sent from the
          local preview.
        </div>
      ) : (
        <form onSubmit={submit} className="form-grid">
          <label className="field wide">
            <span>Name</span>
            <input name="name" required maxLength={200} />
          </label>
          <label className="field wide">
            <span>Email</span>
            <input name="email" type="email" required />
          </label>
          <label className="field wide">
            <span>Access</span>
            <select name="role">
              <option value="editor">
                Editor — add and update instructions
              </option>
              <option value="viewer">Viewer — read-only access</option>
            </select>
          </label>
          <button className="button primary wide" disabled={busy}>
            {busy ? "Sending invitation…" : "Send invitation"}
          </button>
        </form>
      )}
      {message && (
        <div className="info-box" role="status">
          {message}
        </div>
      )}
    </section>
  );
}
