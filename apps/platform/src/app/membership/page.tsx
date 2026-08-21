import type { Metadata } from "next";
import { CheckoutButton } from "@/components/MembershipActions";
import { PlatformPage } from "@/components/PlatformPage";
import {
  getMembershipPriceLabel,
  getStripePriceId,
  membershipPlans,
} from "@/lib/membership";

export const metadata: Metadata = { title: "Membership" };

export default function MembershipPage() {
  return (
    <PlatformPage
      eyebrow="/ membership"
      title={
        <>
          Back the arcade.
          <br />
          <em>Keep play fair.</em>
        </>
      }
      intro="Core accounts, profiles, favorites, and eligible leaderboards stay free. Membership adds comfort, identity, and creator capacity—never a stronger tank or a better score."
    >
      <section className="platformPanel narrowPanel">
        <p className="panelLabel">Free player</p>
        <h2>Play first. Join when it helps.</h2>
        <p>
          Create a profile, save favorites, enter eligible leaderboards, and
          play every free release. If advertising is approved, free players may
          see restrained display ads on calm platform pages—not over gameplay or
          controls.
        </p>
      </section>
      <section className="planGrid">
        {(
          Object.keys(membershipPlans) as Array<keyof typeof membershipPlans>
        ).map((key) => {
          const plan = membershipPlans[key];
          const enabled = Boolean(getStripePriceId(key));
          return (
            <article className="platformPanel planCard" key={key}>
              <p className="panelLabel">{plan.audience}</p>
              <h2>{plan.name}</h2>
              <p>{plan.description}</p>
              <strong className="planPrice">
                {getMembershipPriceLabel(key)}
              </strong>
              <ul className="plainList">
                {plan.entitlements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <CheckoutButton plan={key} enabled={enabled} />
              {!enabled && (
                <span className="quietNote">
                  Preview only—no charge can be created.
                </span>
              )}
            </article>
          );
        })}
      </section>
      <section className="platformPanel narrowPanel">
        <p className="panelLabel">Creator approval</p>
        <h2>Apply free. Subscribe after approval.</h2>
        <p>
          A Creator payment cannot approve an account or publish a game. We
          review ownership, safety, quality, and technical fit first. Approved
          creators can then open paid submission and hosting tools.
        </p>
        <a className="secondaryButton" href="/creators/apply/">
          Read the creator requirements
        </a>
      </section>
      <p className="platformFootnote">
        When checkout opens, Stripe hosts payment and billing management. Signed
        webhooks grant or remove paid access; the browser never grants itself an
        entitlement. Prices, renewal terms, taxes, and cancellation details will
        appear before a real charge can be created.
      </p>
    </PlatformPage>
  );
}
