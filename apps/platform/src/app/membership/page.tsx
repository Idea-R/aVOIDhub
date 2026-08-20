import type { Metadata } from 'next'
import { CheckoutButton } from '@/components/MembershipActions'
import { PlatformPage } from '@/components/PlatformPage'
import { getMembershipPriceLabel, getStripePriceId, membershipPlans } from '@/lib/membership'

export const metadata: Metadata = { title: 'Membership' }

export default function MembershipPage() {
  return (
    <PlatformPage eyebrow="/ membership" title={<>Back the arcade.<br /><em>Keep play fair.</em></>} intro="Membership removes platform ads and opens identity or creator tools. It never buys a better score.">
      <section className="planGrid">
        {(Object.keys(membershipPlans) as Array<keyof typeof membershipPlans>).map((key) => {
          const plan = membershipPlans[key]
          const enabled = Boolean(getStripePriceId(key))
          return (
            <article className="platformPanel planCard" key={key}>
              <p className="panelLabel">{plan.audience}</p>
              <h2>{plan.name}</h2>
              <p>{plan.description}</p>
              <strong className="planPrice">{getMembershipPriceLabel(key)}</strong>
              <ul className="plainList">{plan.entitlements.map((item) => <li key={item}>{item}</li>)}</ul>
              <CheckoutButton plan={key} enabled={enabled} />
              {!enabled && <span className="quietNote">Preview only—no charge can be created.</span>}
            </article>
          )
        })}
      </section>
      <p className="platformFootnote">Checkout is hosted by Stripe. Billing state is confirmed by signed webhooks; the browser never grants its own access.</p>
    </PlatformPage>
  )
}

