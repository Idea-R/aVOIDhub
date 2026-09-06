import { describe, expect, it } from "vitest";

import { WRECKAVOID_SIGN_IN_PATH } from "./platformAuth";

describe("WreckaVOID platform sign-in", () => {
  it("uses the platform next contract to return to the game", () => {
    const url = new URL(WRECKAVOID_SIGN_IN_PATH, "https://avoidgame.io");

    expect(url.pathname).toBe("/login/");
    expect(url.searchParams.get("next")).toBe("/wreckavoid/");
    expect(url.searchParams.has("returnTo")).toBe(false);
  });
});
