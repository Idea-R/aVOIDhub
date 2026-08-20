# aVOIDgame.io AdSense readiness

Updated: 2026-08-19

## Current state

- Google AdSense manages ordinary subdomains under the root-domain site entry. `flipside.avoidgame.io` should not be added as a separate site from `avoidgame.io`.
- The currently signed-in Google account is not associated with an AdSense account. Confirm the correct account before requesting review or copying a publisher identifier.
- Production currently returns the legacy app shell at `/ads.txt`, which is a soft 404 rather than a valid authorized-sellers file.
- The rebuilt platform now has `/privacy/`, `/terms/`, and an environment-validated `google-adsense-account` verification meta tag.
- No ad tag, ad request, auto-ad placement, or consent script is active.

## Required account inputs

1. The Google account that owns the AdSense profile.
2. The exact publisher identifier in `ca-pub-0000000000000000` form.
3. Confirmation that `avoidgame.io` shows `Ready`, `Getting ready`, `Requires review`, or `Needs attention` in AdSense Sites.
4. The selected Google Privacy & messaging configuration for European and applicable US-state regulation messages.

## Activation sequence

1. Set `NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT` in the Netlify deploy context. The platform emits the verification meta tag only when the value matches the expected publisher-ID format.
2. Publish `https://avoidgame.io/ads.txt` with the exact AdSense line supplied by the account. Confirm an HTTP 200 text response rather than the legacy HTML fallback.
3. Request or complete site review only after the rebuilt site is public and crawler-accessible.
4. Configure Google's certified consent flow in AdSense Privacy & messaging before personalized ad requests are served in the EEA, UK, or Switzerland.
5. Create explicit responsive display units. Do not start with Auto ads; controlled units make placement, layout reservation, and game-surface exclusions reviewable.
6. Load the AdSense runtime only after the account, consent, and placement gates are complete.
7. Verify layout shift, keyboard order, consent behavior, crawler access, mobile density, and ad-free gameplay on the deployed domain.

## Placement rules

- Allowed: one reserved directory unit after the hosted-games catalog and an optional lower-priority unit after the platform roadmap.
- Disallowed: active game routes, canvases, HUDs, pause menus, game-over actions, launch controls, navigation, or any surface where an ad could be mistaken for a game control.
- Mobile: never stack an ad immediately against a launch button; keep a clear section boundary and reserve the full unit height before loading.
- Membership: an eventual ad-free benefit removes directory ads only; it must not imply that paying changes gameplay or scoring.

## Subdomain notes

- Root approval covers normal `*.avoidgame.io` subdomains for site management.
- The AdSense tag still needs to be present on every subdomain page where ads should appear.
- The root `avoidgame.io/ads.txt` entry applies when the same authorized seller and publisher ID are used. A separate subdomain declaration is only needed if the authorized seller or publisher ID differs.

## Official references

- [Site management is changing in AdSense](https://support.google.com/adsense/answer/12170421?hl=en)
- [Add a new site to your AdSense sites list](https://support.google.com/adsense/answer/12169212?hl=en)
- [Required privacy-policy content](https://support.google.com/adsense/answer/1348695?hl=en)
- [Ads.txt FAQs](https://support.google.com/adsense/answer/9785052?hl=en)
- [Google consent-management requirements](https://support.google.com/adsense/answer/13554020?hl=en)
