"use client";

import { useState, type FormEvent } from "react";

export function GameSubmissionForm({ enabled = true }: { enabled?: boolean }) {
  const [status, setStatus] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("Sending the build to review…");
    const response = await fetch("/api/creators/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        gameUrl: form.get("gameUrl"),
        sourceUrl: form.get("sourceUrl"),
        summary: form.get("summary"),
        requestedHosting: form.get("requestedHosting"),
      }),
    });
    if (response.status === 401) {
      window.location.assign('/login/?next=/creators/submit/')
      return
    }
    const data = await response.json();
    setStatus(
      response.ok
        ? "Game received. It stays private until review is complete."
        : data.error === "creator_approval_required"
          ? "Creator approval comes first. Apply before opening paid creator tools."
          : data.error === "creator_membership_required"
            ? "Your creator approval is active, but game submissions require an active Creator membership."
            : "The game could not be submitted.",
    );
  }
  return (
    <form className="platformForm" onSubmit={submit}>
      <label htmlFor="title">Game title</label>
      <input id="title" name="title" minLength={2} maxLength={80} required />
      <label htmlFor="gameUrl">Playable review URL</label>
      <input
        id="gameUrl"
        name="gameUrl"
        type="url"
        placeholder="https://"
        required
      />
      <label htmlFor="sourceUrl">
        Source or build notes URL <span>optional</span>
      </label>
      <input
        id="sourceUrl"
        name="sourceUrl"
        type="url"
        placeholder="https://"
      />
      <label htmlFor="summary">
        What is the game, and what help does it need?
      </label>
      <textarea
        id="summary"
        name="summary"
        minLength={40}
        maxLength={2000}
        rows={7}
        required
      />
      <label htmlFor="requestedHosting">Requested lane</label>
      <select
        id="requestedHosting"
        name="requestedHosting"
        defaultValue="directory"
      >
        <option value="directory">Directory listing</option>
        <option value="subdomain">aVOID subdomain</option>
        <option value="managed">Managed platform build</option>
      </select>
      <button className="primaryButton" type="submit" disabled={!enabled}>
        Submit private review
      </button>
      <p className="formStatus" aria-live="polite">
        {status || (!enabled ? 'Preview only—submission requires a connected, eligible creator account.' : 'The build stays private until review is complete.')}
      </p>
    </form>
  );
}
