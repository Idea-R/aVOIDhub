import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request-user";
import { getCreatorSubmissionEligibility } from "@/lib/creators/server";
import { hasAllowedWriteOrigin } from "@/lib/http/same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  title: z.string().trim().min(2).max(80),
  gameUrl: z.string().url().max(500),
  sourceUrl: z.union([z.literal(""), z.string().url().max(500)]).default(""),
  summary: z.string().trim().min(40).max(2000),
  requestedHosting: z.enum(["directory", "subdomain", "managed"]),
});

export async function POST(request: NextRequest) {
  if (!hasAllowedWriteOrigin(request))
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  const user = await getRequestUser(request);
  if (!user)
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  const eligibility = await getCreatorSubmissionEligibility(user.id);
  if (!eligibility.allowed) {
    return NextResponse.json({ error: eligibility.reason }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "invalid_game_submission" },
      { status: 400 },
    );

  const { data, error } = await createAdminClient()
    .from("game_submissions")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      game_url: parsed.data.gameUrl,
      source_url: parsed.data.sourceUrl || null,
      summary: parsed.data.summary,
      requested_hosting: parsed.data.requestedHosting,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select("id, status, submitted_at")
    .single();
  if (error)
    return NextResponse.json(
      { error: "game_submission_failed" },
      { status: 500 },
    );
  return NextResponse.json(data, { status: 201 });
}
