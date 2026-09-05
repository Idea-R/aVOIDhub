export interface CreatorApplicationDraft {
  displayName: string;
  portfolioUrl: string;
  pitch: string;
}

interface StoredCreatorApplicationDraft extends CreatorApplicationDraft {
  savedAt: number;
  version: 1;
}

interface DraftStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export const CREATOR_APPLICATION_DRAFT_KEY =
  "avoid.creator-application-draft";
export const CREATOR_APPLICATION_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

function isStoredDraft(value: unknown): value is StoredCreatorApplicationDraft {
  if (!value || typeof value !== "object") return false;

  const draft = value as Record<string, unknown>;
  return (
    draft.version === 1 &&
    typeof draft.savedAt === "number" &&
    Number.isFinite(draft.savedAt) &&
    typeof draft.displayName === "string" &&
    draft.displayName.length >= 2 &&
    draft.displayName.length <= 60 &&
    typeof draft.portfolioUrl === "string" &&
    draft.portfolioUrl.length <= 500 &&
    typeof draft.pitch === "string" &&
    draft.pitch.length >= 40 &&
    draft.pitch.length <= 2000
  );
}

export function saveCreatorApplicationDraft(
  storage: DraftStorage,
  draft: CreatorApplicationDraft,
  now = Date.now(),
): boolean {
  try {
    storage.setItem(
      CREATOR_APPLICATION_DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: now, version: 1 }),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadCreatorApplicationDraft(
  storage: DraftStorage,
  now = Date.now(),
): CreatorApplicationDraft | null {
  try {
    const stored = storage.getItem(CREATOR_APPLICATION_DRAFT_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (
      !isStoredDraft(parsed) ||
      parsed.savedAt > now ||
      now - parsed.savedAt > CREATOR_APPLICATION_DRAFT_TTL_MS
    ) {
      storage.removeItem(CREATOR_APPLICATION_DRAFT_KEY);
      return null;
    }

    return {
      displayName: parsed.displayName,
      portfolioUrl: parsed.portfolioUrl,
      pitch: parsed.pitch,
    };
  } catch {
    try {
      storage.removeItem(CREATOR_APPLICATION_DRAFT_KEY);
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }
    return null;
  }
}

export function clearCreatorApplicationDraft(storage: DraftStorage): void {
  try {
    storage.removeItem(CREATOR_APPLICATION_DRAFT_KEY);
  } catch {
    // A successful application should not be reported as failed by storage cleanup.
  }
}
