import { describe, expect, it } from "vitest";

import {
  CREATOR_APPLICATION_DRAFT_KEY,
  CREATOR_APPLICATION_DRAFT_TTL_MS,
  loadCreatorApplicationDraft,
  saveCreatorApplicationDraft,
} from "./application-draft";

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) {
    values.set(CREATOR_APPLICATION_DRAFT_KEY, initial);
  }

  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

const draft = {
  displayName: "Orbit Works",
  portfolioUrl: "https://example.com/game",
  pitch: "A deliberately long creator pitch that should survive sign-in.",
};

describe("creator application drafts", () => {
  it("round-trips every application field through session storage", () => {
    const storage = memoryStorage();

    expect(saveCreatorApplicationDraft(storage, draft, 1_000)).toBe(true);
    expect(loadCreatorApplicationDraft(storage, 2_000)).toEqual(draft);
  });

  it("discards an expired draft", () => {
    const storage = memoryStorage();
    saveCreatorApplicationDraft(storage, draft, 1_000);

    expect(
      loadCreatorApplicationDraft(
        storage,
        1_000 + CREATOR_APPLICATION_DRAFT_TTL_MS + 1,
      ),
    ).toBeNull();
    expect(storage.getItem(CREATOR_APPLICATION_DRAFT_KEY)).toBeNull();
  });

  it.each(["not-json", JSON.stringify({ version: 1, savedAt: 1, pitch: 42 })])(
    "discards a malformed draft: %s",
    (stored) => {
      const storage = memoryStorage(stored);

      expect(loadCreatorApplicationDraft(storage, 2_000)).toBeNull();
      expect(storage.getItem(CREATOR_APPLICATION_DRAFT_KEY)).toBeNull();
    },
  );

  it("reports unavailable storage without throwing", () => {
    const storage = {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error("storage disabled");
      },
    };

    expect(saveCreatorApplicationDraft(storage, draft)).toBe(false);
  });
});
