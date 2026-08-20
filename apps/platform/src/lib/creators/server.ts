import "server-only";

import { evaluateCreatorSubmissionEligibility } from "@/lib/creators/eligibility";
import { hasEntitlement } from "@/lib/profiles/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function hasApprovedCreatorApplication(
  userId: string,
): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("creator_applications")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function getCreatorSubmissionEligibility(userId: string) {
  const [approved, hasSubmissionEntitlement] = await Promise.all([
    hasApprovedCreatorApplication(userId),
    hasEntitlement(userId, "creator.submit_game"),
  ]);

  return evaluateCreatorSubmissionEligibility({
    applicationStatus: approved ? "approved" : null,
    hasSubmissionEntitlement,
  });
}
