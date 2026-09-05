import type { CreatorApplicationDraft } from "./application-draft";

export type CreatorApplicationResult =
  | "application_already_open"
  | "authentication_required"
  | "failed"
  | "received";

interface ApplicationResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

type ApplicationFetch = (
  input: string,
  init: RequestInit,
) => Promise<ApplicationResponse>;

function getErrorCode(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" ? error : null;
}

export async function submitCreatorApplication(
  draft: CreatorApplicationDraft,
  request: ApplicationFetch = fetch,
): Promise<CreatorApplicationResult> {
  let response: ApplicationResponse;

  try {
    response = await request("/api/creators/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
  } catch {
    return "failed";
  }

  if (response.status === 401) return "authentication_required";
  try {
    const data = await response.json();
    if (response.ok) {
      return data && typeof data === "object" &&
        typeof (data as Record<string, unknown>).id === "string"
        ? "received"
        : "failed";
    }
    return getErrorCode(data) === "application_already_open"
      ? "application_already_open"
      : "failed";
  } catch {
    return "failed";
  }
}

export function createCreatorApplicationSubmitter(
  request: ApplicationFetch = fetch,
) {
  let inFlight: Promise<CreatorApplicationResult> | null = null;

  return (draft: CreatorApplicationDraft) => {
    if (inFlight) return inFlight;

    const submission = submitCreatorApplication(draft, request);
    inFlight = submission;
    void submission.finally(() => {
      if (inFlight === submission) inFlight = null;
    });
    return submission;
  };
}
