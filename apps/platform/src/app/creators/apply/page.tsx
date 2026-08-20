import type { Metadata } from "next";
import { CreatorApplicationForm } from "@/components/CreatorApplicationForm";
import { PlatformPage } from "@/components/PlatformPage";
import { isPlatformRuntimeConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Become a creator" };

export default function CreatorApplyPage() {
  return (
    <PlatformPage
      eyebrow="/ creator intake"
      title={
        <>
          Bring a game.
          <br />
          <em>Keep its voice.</em>
        </>
      }
      intro="Applying is free. Show us what you made, prove you can publish it, and choose the kind of help you need. Approval comes before any paid creator tools."
    >
      <section className="platformDashboard creatorIntake">
        <article className="platformPanel">
          <p className="panelLabel">How it works</p>
          <ol className="numberedList">
            <li>
              <strong>Apply free.</strong>
              <span>
                Use a signed-in account and share a playable game, portfolio, or
                convincing work in progress.
              </span>
            </li>
            <li>
              <strong>Prove the rights.</strong>
              <span>
                You must own or license the code, art, music, names, and other
                material you submit.
              </span>
            </li>
            <li>
              <strong>Pass review.</strong>
              <span>
                We check quality, safety, privacy, mobile/desktop behavior, and
                technical fit.
              </span>
            </li>
            <li>
              <strong>Choose a lane.</strong>
              <span>
                External directory listing, an aVOID subdomain, or a managed
                platform build.
              </span>
            </li>
            <li>
              <strong>Open creator tools.</strong>
              <span>
                After approval, an active Creator membership opens private game
                submissions and hosting review.
              </span>
            </li>
          </ol>
        </article>
        <article className="platformPanel">
          <CreatorApplicationForm enabled={isPlatformRuntimeConfigured()} />
        </article>
      </section>
      <section className="planGrid">
        <article className="platformPanel planCard">
          <p className="panelLabel">Required</p>
          <h2>A build we can actually inspect</h2>
          <ul className="plainList">
            <li>A working HTTPS review URL or downloadable build</li>
            <li>Clear ownership and licenses</li>
            <li>Truthful screenshots, description, and creator identity</li>
            <li>
              No malware, deceptive flows, stolen work, or prohibited content
            </li>
          </ul>
        </article>
        <article className="platformPanel planCard">
          <p className="panelLabel">For hosted games</p>
          <h2>A release that respects players</h2>
          <ul className="plainList">
            <li>Usable keyboard, pointer, and claimed-device behavior</li>
            <li>A privacy explanation for any collected data</li>
            <li>No direct writes into shared score tables</li>
            <li>Reviewable updates, rollback, and a real support contact</li>
          </ul>
        </article>
      </section>
      <p className="platformFootnote">
        Approval is not publication. Every game remains private until its
        content, security, hosting, leaderboard, advertising, and release checks
        pass. Creator revenue sharing is not part of this first subscription and
        would require separate terms and payout onboarding.
      </p>
    </PlatformPage>
  );
}
