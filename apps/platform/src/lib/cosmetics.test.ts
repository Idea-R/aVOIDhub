import { describe, expect, it } from "vitest";
import { cosmeticOptions } from "./cosmetics";

describe("launch cosmetics", () => {
  it("keeps standard game looks free", () => {
    expect(cosmeticOptions("wreckavoid", new Set())[0]).toMatchObject({
      id: "standard",
      unlocked: true,
    });
    expect(cosmeticOptions("tankavoid", new Set())[0]).toMatchObject({
      id: "standard",
      unlocked: true,
    });
    expect(cosmeticOptions("wreckavoid", new Set())[1]).toMatchObject({
      id: "founder-ember",
      unlocked: false,
    });
    expect(cosmeticOptions("tankavoid", new Set())[1]).toMatchObject({
      id: "founder-meteor",
      unlocked: false,
    });
  });

  it("unlocks both founder looks from the shared supporter entitlement", () => {
    const entitlements = new Set(["cosmetics.supporter"]);
    expect(cosmeticOptions("wreckavoid", entitlements)[1]).toMatchObject({
      id: "founder-ember",
      unlocked: true,
    });
    expect(cosmeticOptions("tankavoid", entitlements)[1]).toMatchObject({
      id: "founder-meteor",
      unlocked: true,
    });
  });
});
