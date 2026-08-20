# aVOID membership and creator V1 contract

- Date: 2026-08-20
- Issue: [#38](https://github.com/Idea-R/aVOIDhub/issues/38)
- Draft review: [#39](https://github.com/Idea-R/aVOIDhub/pull/39)
- Branch: `codex/feature-membership-creator-contract`
- Runtime state: source and test-mode preparation only; no live charge, ad request, creator publication, or production migration

## Product rule

People pay for comfort, identity, cosmetics, early access, and creator capacity. They do not pay for a better score, stronger equipment, automatic creator approval, automatic publication, or a place above another player.

Core platform participation stays free. A person can create an account, keep an ordinary profile, save favorites, play free games, and enter an eligible leaderboard without subscribing.

## Offers

| Offer           | Who it is for                                    | V1 value                                                                                                                                                     | What it does not buy                                                                                                        |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Free player     | Anyone playing on aVOID                          | Free games, ordinary profile, favorites, eligible leaderboards, public receipts                                                                              | Ad-free treatment, member cosmetics, creator tools, score advantage                                                         |
| Founding Player | People who want to support the platform          | No platform display ads on eligible aVOID pages, permanent founding mark, selected early experiments, supporter cosmetics as individual games implement them | Gameplay power, guaranteed release access, external-domain ad removal, ownership of game assets                             |
| Creator         | Approved game makers with an active subscription | Everything in Player plus private game submissions and directory/subdomain/managed-build review workflows                                                    | Creator approval, automatic publication, unlimited hosting, guaranteed monetization, shared leaderboard acceptance, payouts |

The first public price remains unset until benefits, tax treatment, renewal/cancellation language, and cost ceilings are approved. Stripe test-mode Products and Prices can be exercised before any live price is announced.

## Creator qualification

Applying is free and requires a signed-in platform account. A useful application includes a working game, portfolio, or convincing playable work in progress plus an honest explanation of ownership and the requested hosting lane.

A creator must:

- own or hold usable licenses for submitted code, art, audio, brands, names, and other content;
- provide a working HTTPS review URL or downloadable build;
- identify themselves or their studio truthfully;
- provide current contact and support information;
- avoid malware, deceptive downloads, stolen work, prohibited content, and hidden monetization;
- disclose data collection and provide a privacy explanation where applicable;
- support the devices and inputs the listing claims;
- accept private review, requested changes, and reversible deployment; and
- use the platform run/score contract before claiming an aVOID leaderboard.

For a monetized hosting agreement or future payout, the contracting person must be legally able to accept the applicable terms. A minor would need an approved parent or guardian arrangement before paid hosting or payouts.

## Creator state machine

```text
free account
    -> free creator application
    -> pending / reviewing
    -> approved or declined

approved + no active Creator subscription
    -> owns review history
    -> cannot open paid submission/hosting capacity

approved + active Creator subscription
    -> can submit privately
    -> directory / subdomain / managed review
    -> changes requested / approved / declined
    -> publisher review and explicit launch
```

Approval and payment are independent gates. The submission API opens only at their intersection. Canceling the subscription removes paid submission capacity but does not erase the creator's application, profile ownership, prior submissions, or review history. Paying never changes an application to approved.

## Hosting lanes

### External directory listing

The game keeps its own domain, account system, data, scores, and operations. aVOID provides an editorial detail page and outbound launch. The listing must not imply shared membership or leaderboards where none exist.

### aVOID subdomain

The creator operates a reviewed build under an aVOID subdomain. DNS, deployment owner, privacy boundary, support contact, analytics, advertising, and rollback are recorded before launch. A subdomain does not automatically join platform auth or scores.

### Managed platform build

The game is assembled and released through the platform pipeline. It must pass build, security, responsive, accessibility, content, score-trust, preview, production-smoke, and rollback gates. Hosting payment does not waive any gate.

## Money paths

### Player and Creator subscriptions

Use Stripe Billing with hosted Checkout and the Customer Portal. Products and Prices define the offers. Signed, idempotent webhooks—not the browser or a success redirect—reconcile subscription state and entitlements. Cancellation and non-entitled statuses remove subscription-sourced access.

### Cosmetic purchases

One-time cosmetics are a separate Checkout product family. Fulfillment must come from a signed webhook and create an idempotent, account-owned entitlement. Cosmetics may change presentation, profile flair, vehicles, trails, paint, impact effects, or similarly noncompetitive surfaces. They may not alter score, damage, armor, movement, ranked availability, or matchmaking power.

### Advertising

Free users may receive manually placed display ads only on calm, eligible platform surfaces after AdSense site approval, consent/age treatment, privacy, layout, and policy gates pass. Paid ad-free users send no eligible ad request. Google ads do not belong over gameplay, game controls, results, leaderboards, checkout, login, creator review, or coming-soon pages. In-world billboards remain house art or separately contracted sponsorship—not ordinary AdSense units.

### Creator revenue sharing

Revenue sharing is not part of membership V1. If aVOID later collects money on behalf of creators, that becomes a marketplace program with separate economics, tax/liability decisions, creator terms, refund/dispute ownership, and Stripe Connect onboarding. A Creator subscription alone creates no payout balance or revenue share.

## Activation gates

Before a real subscription or cosmetic charge:

- approve exact benefits and prices;
- create separate Stripe test and live Products/Prices;
- use least-privilege restricted keys where supported;
- pass Checkout, Customer Portal, signature, duplicate-event, out-of-order-event, cancel, payment-failure, and entitlement-revocation tests;
- prevent duplicate customers and concurrent duplicate subscriptions;
- show price, cadence, renewal, cancellation, refund, and applicable tax language before purchase;
- confirm tax registrations before enabling automatic tax collection;
- apply and verify the coordinated Supabase migration; and
- pass a deploy-preview transaction with synthetic accounts before production.

Before advertising, finish the separate AdSense/CMP/age/privacy/site-review gates. Before creator publication, finish the separate moderation and hosting release gates.

## V1 acceptance

- A free player keeps core profile and eligible leaderboard access.
- Applying for creator status creates no charge.
- An unapproved person with a Creator subscription entitlement cannot submit a game.
- An approved creator without an active Creator subscription cannot use paid submission capacity.
- An approved creator with active membership can submit only to the private review queue.
- Payment cannot publish a creator profile or game.
- Subscription cancellation removes subscription-sourced capacity without deleting review history.
- Player and creator benefits never change competitive gameplay or score trust.
- Free ad eligibility and paid ad suppression are testable without placing ads in gameplay.
- No live charge, creator payout, ad request, or public game occurs merely because the source gate passes.
