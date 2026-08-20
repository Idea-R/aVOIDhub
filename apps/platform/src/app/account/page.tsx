import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BillingPortalButton } from "@/components/MembershipActions";
import { PlatformPage } from "@/components/PlatformPage";
import { SignOutButton } from "@/components/AccountActions";
import { ProfileForm } from "@/components/ProfileForm";
import { isPlatformRuntimeConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your profile" };

export default async function AccountPage() {
  if (!isPlatformRuntimeConfigured()) {
    return (
      <PlatformPage
        eyebrow="/ player profile"
        title={
          <>
            Your aVOID
            <br />
            <em>signal.</em>
          </>
        }
        intro="Profiles are built and waiting for the production runtime."
      >
        <section className="platformPanel">
          <p>Account access is not enabled on this preview.</p>
        </section>
      </PlatformPage>
    );
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login/");
  const now = new Date().toISOString();

  const [{ data: profile }, { data: entitlements }, { data: creatorApproval }] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select(
          "username, display_name, bio, is_public, social_links, created_at",
        )
        .eq("id", userData.user.id)
        .maybeSingle(),
      supabase
        .from("user_entitlements")
        .select("entitlement_key, expires_at")
        .eq("user_id", userData.user.id)
        .or(`expires_at.is.null,expires_at.gt.${now}`),
      supabase
        .from("creator_applications")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle(),
    ]);

  const hasCreatorMembership =
    entitlements?.some(
      (item) => item.entitlement_key === "creator.submit_game",
    ) ?? false;
  const canSubmitGame = Boolean(creatorApproval) && hasCreatorMembership;

  return (
    <PlatformPage
      eyebrow="/ player profile"
      title={
        <>
          Your aVOID
          <br />
          <em>signal.</em>
        </>
      }
      intro="Scores, favorites, memberships, and creator tools meet here."
    >
      <section className="platformDashboard">
        <article className="platformPanel">
          <p className="panelLabel">Identity</p>
          <h2>
            {profile?.username ||
              userData.user.email?.split("@")[0] ||
              "Player"}
          </h2>
          <p>{userData.user.email}</p>
          <div className="buttonRow">
            <SignOutButton />
          </div>
        </article>
        <article className="platformPanel">
          <p className="panelLabel">Membership</p>
          <h2>{entitlements?.length ? "Active" : "Free player"}</h2>
          <ul className="plainList">
            {(entitlements ?? []).map((item) => (
              <li key={item.entitlement_key}>
                {item.entitlement_key.replaceAll(".", " / ")}
              </li>
            ))}
            {!entitlements?.length && (
              <li>Platform ads may appear after AdSense approval.</li>
            )}
          </ul>
          <div className="buttonRow">
            <a className="secondaryButton" href="/membership/">
              Membership options
            </a>
            {canSubmitGame && (
              <a className="secondaryButton" href="/creators/submit/">
                Submit a game
              </a>
            )}
            <BillingPortalButton />
          </div>
        </article>
        <article className="platformPanel profileEditor">
          <p className="panelLabel">Public profile</p>
          <h2>Shape your signal</h2>
          <ProfileForm profile={profile || {}} />
        </article>
      </section>
    </PlatformPage>
  );
}
