"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  clearCreatorApplicationDraft,
  loadCreatorApplicationDraft,
  saveCreatorApplicationDraft,
  type CreatorApplicationDraft,
} from "@/lib/creators/application-draft";
import { createCreatorApplicationSubmitter } from "@/lib/creators/application-request";

const emptyDraft: CreatorApplicationDraft = {
  displayName: "",
  portfolioUrl: "",
  pitch: "",
};

export function CreatorApplicationForm({ enabled }: { enabled: boolean }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const submitter = useRef<ReturnType<
    typeof createCreatorApplicationSubmitter
  > | null>(null);

  if (!submitter.current) {
    submitter.current = createCreatorApplicationSubmitter();
  }

  useEffect(() => {
    try {
      const restored = loadCreatorApplicationDraft(window.sessionStorage);
      if (restored) {
        setDraft(restored);
        setStatus("Your saved application draft was restored.");
      }
    } catch {
      // Accessing sessionStorage itself can fail in privacy-restricted contexts.
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || isSubmitting) return;

    let draftSaved = false;
    try {
      draftSaved = saveCreatorApplicationDraft(window.sessionStorage, draft);
    } catch {
      // Keep the populated form on screen when storage is unavailable.
    }

    setIsSubmitting(true);
    setStatus("Submitting for review…");
    const result = await submitter.current!(draft);

    if (result === "authentication_required") {
      if (draftSaved) {
        window.location.assign("/login/?next=/creators/apply/");
        return;
      }
      setStatus(
        "Sign-in is required, but this browser could not save your draft. Copy your pitch before signing in, then try again.",
      );
    } else if (result === "received") {
      try {
        clearCreatorApplicationDraft(window.sessionStorage);
      } catch {
        // The accepted application is authoritative even if local cleanup fails.
      }
      setStatus(
        "Application received. We will review the game, ownership, and hosting fit before anything goes live.",
      );
    } else if (result === "application_already_open") {
      setStatus("You already have an application in review.");
    } else {
      setStatus(
        "The application could not be submitted. Your draft is still here; check the fields and try again.",
      );
    }

    setIsSubmitting(false);
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
        readOnly={isSubmitting}
        value={draft.displayName}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            displayName: event.target.value,
          }))
        }
      />
      <label htmlFor="portfolioUrl">
        Portfolio or game URL <span>optional</span>
      </label>
      <input
        id="portfolioUrl"
        name="portfolioUrl"
        type="url"
        maxLength={500}
        placeholder="https://"
        readOnly={isSubmitting}
        value={draft.portfolioUrl}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            portfolioUrl: event.target.value,
          }))
        }
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
        readOnly={isSubmitting}
        value={draft.pitch}
        onChange={(event) =>
          setDraft((current) => ({ ...current, pitch: event.target.value }))
        }
      />
      <button
        className="primaryButton"
        type="submit"
        disabled={!enabled || isSubmitting}
      >
        {isSubmitting ? "Submitting…" : "Submit for review"}
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
