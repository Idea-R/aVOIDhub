import { describe, expect, it } from "vitest";

import { evaluateCreatorSubmissionEligibility } from "./eligibility";

describe("creator submission eligibility", () => {
  it.each([null, "pending", "reviewing", "declined", "withdrawn"] as const)(
    "does not let a paid %s application bypass review",
    (applicationStatus) => {
      expect(
        evaluateCreatorSubmissionEligibility({
          applicationStatus,
          hasSubmissionEntitlement: true,
        }),
      ).toEqual({ allowed: false, reason: "creator_approval_required" });
    },
  );

  it("holds paid creator tools when an approved creator has no active entitlement", () => {
    expect(
      evaluateCreatorSubmissionEligibility({
        applicationStatus: "approved",
        hasSubmissionEntitlement: false,
      }),
    ).toEqual({ allowed: false, reason: "creator_membership_required" });
  });

  it("opens private submission only at the approval and membership intersection", () => {
    expect(
      evaluateCreatorSubmissionEligibility({
        applicationStatus: "approved",
        hasSubmissionEntitlement: true,
      }),
    ).toEqual({ allowed: true, reason: null });
  });
});
