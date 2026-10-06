# Forum Index website

A small, dependency-free landing page for the Forum Index iOS and Android apps.
Production domain: https://theforumindex.com.

## Local preview

Run `python3 -m http.server 8080 --directory public` and open http://localhost:8080.
Edit `public/index.html`, `public/styles.css`, and `public/preview.js` directly; no build is required.
The logo and icon come from the adjacent `forum-index-app` repository.
The angled preview plays `public/assets/app-preview.mp4`, an actual iPhone
simulator recording of the native app using its curated public-topic fixtures.
The recording moves through lists and a native Markdown reader, changes between
light and dark appearance, and returns to the opening list. It is edited for a
quicker pace and a seamless loop, with the phone cropped a little below halfway.
There are no playback controls. Reduced-motion preferences show the opening
frame; playback pauses when off screen or in a hidden tab. The JPEG poster also
provides a still preview when JavaScript or autoplay is unavailable.

The Apple button links to the public TestFlight beta. The Google Play button is
intentionally inert and uses `aria-disabled="true"` so it remains keyboard-focusable
for its tooltip. Add the Google Play link when released.

## Privacy policy

The homepage links to `public/privacy/index.html`, served at `/privacy/`.
The policy is a draft until the following are resolved:

- Implement and verify a 90-day retention limit for contribution activity logs
  in the backend, then update the policy to describe the enforced limit.
- Confirm retention and deletion handling for device and contributor records.

The website copy does not implement backend retention or deletion.

## Cloudflare Pages

The `forum-index-website` Pages project uses Cloudflare's native GitHub integration.
Every push to `main` deploys production; other branches receive preview deployments.
No GitHub Actions workflow or deployment secret is required. Deployment status and
build logs are available in the Cloudflare Pages dashboard. Project settings:

| Setting | Value |
| --- | --- |
| Repository | `pmusaraj/forum-index-website` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `exit 0` |
| Build output directory | `public` |

Pages URL: https://forum-index-website.pages.dev.

To deploy manually, retry a deployment in the Cloudflare Pages dashboard.

Both `theforumindex.com` and `www.theforumindex.com` are associated with the Pages
project and serve the landing page over HTTPS. Their proxied DNS records target
`forum-index-website.pages.dev`. Manage these records in the Cloudflare dashboard;
the CLI OAuth session used for setup does not have DNS permissions.

References: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
and [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
