"use client";

import { useState, type FormEvent } from "react";

export function CreatorApplicationForm({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("Submitting for review…");
    const response = await fetch("/api/creators/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        portfolioUrl: form.get("portfolioUrl"),
        pitch: form.get("pitch"),
      }),
    });
    if (response.status === 401) {
      window.location.assign("/login/");
      return;
    }
    const data = await response.json();
    setStatus(
      response.ok
        ? "Application received. We will review the game, ownership, and hosting fit before anything goes live."
        : data.error === "application_already_open"
          ? "You already have an application in review."
          : "The application could not be submitted. Check the fields and try again.",
    );
  }

  return (
    <form className="platformForm" onSubmit={submit}>
      <label htmlFor="displayName">Creator or studio name</label>
      <input
        id="displayName"
        name="displayName"
        minLength={2}
        maxLength={60}
        required
      />
      <label htmlFor="portfolioUrl">
        Portfolio or game URL <span>optional</span>
      </label>
      <input
        id="portfolioUrl"
        name="portfolioUrl"
        type="url"
        placeholder="https://"
      />
      <label htmlFor="pitch">
        What did you make, what do you own, and what help do you need?
      </label>
      <textarea
        id="pitch"
        name="pitch"
        minLength={40}
        maxLength={2000}
        rows={7}
        required
      />
      <button className="primaryButton" type="submit" disabled={!enabled}>
        Submit for review
      </button>
      <p className="formStatus" aria-live="polite">
        {status ||
          (enabled
            ? "Applying is free. Payment never replaces creator or game review."
            : "Applications open with account access.")}
      </p>
    </form>
  );
}
