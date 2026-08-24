import { NextResponse, type NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth/request-user";
import { cosmeticOptions } from "@/lib/cosmetics";
import { isPlatformRuntimeConfigured } from "@/lib/env";
import { ensureUserProfile } from "@/lib/profiles/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  if (!isPlatformRuntimeConfigured()) {
    return NextResponse.json({
      authenticated: false,
      player: null,
      entitlements: [],
      cosmetics: null,
    });
  }

  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({
      authenticated: false,
      player: null,
      entitlements: [],
      cosmetics: null,
    });
  }

  await ensureUserProfile(user);
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const [profileResult, entitlementResult] = await Promise.all([
    admin
      .from("user_profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .single(),
    admin
      .from("user_entitlements")
      .select("entitlement_key")
      .eq("user_id", user.id)
      .or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);

  if (profileResult.error || entitlementResult.error) {
    return NextResponse.json(
      { error: "player_context_unavailable" },
      { status: 503 },
    );
  }

  const entitlementKeys = (entitlementResult.data ?? []).map(
    (item) => item.entitlement_key,
  );
  const entitlements = new Set(entitlementKeys);
  return NextResponse.json({
    authenticated: true,
    player: {
      id: user.id,
      username: profileResult.data.username,
      displayName:
        profileResult.data.display_name || profileResult.data.username,
    },
    entitlements: entitlementKeys,
    cosmetics: {
      wreckavoid: cosmeticOptions("wreckavoid", entitlements),
      tankavoid: cosmeticOptions("tankavoid", entitlements),
    },
  });
}
