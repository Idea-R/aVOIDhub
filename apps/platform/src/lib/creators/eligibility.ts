export type CreatorApplicationStatus =
  "pending" | "reviewing" | "approved" | "declined" | "withdrawn" | null;

export type CreatorSubmissionDenial =
  "creator_approval_required" | "creator_membership_required";

export type CreatorSubmissionEligibility =
  | { allowed: true; reason: null }
  | { allowed: false; reason: CreatorSubmissionDenial };

export function evaluateCreatorSubmissionEligibility(input: {
  applicationStatus: CreatorApplicationStatus;
  hasSubmissionEntitlement: boolean;
}): CreatorSubmissionEligibility {
  if (input.applicationStatus !== "approved") {
    return { allowed: false, reason: "creator_approval_required" };
  }

  if (!input.hasSubmissionEntitlement) {
    return { allowed: false, reason: "creator_membership_required" };
  }

  return { allowed: true, reason: null };
}
