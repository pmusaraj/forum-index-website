# Forum Index website

A small, dependency-free landing page for the Forum Index iOS, macOS and Android apps.
Production domain: https://theforumindex.com.

## Local preview

Run `python3 -m http.server 8080 --directory public` and open http://localhost:8080.
Edit `public/index.html`, `public/styles.css`, and `public/preview.js` directly; no build is required.
The logo and icon come from the adjacent `forum-index-app` repository.
At `?q=video`, the angled preview plays `public/assets/app-preview.mp4`, an actual iPhone
simulator recording of the native app using its curated public-topic fixtures.
The recording moves through lists and a native Markdown reader, changes between
light and dark appearance, and returns to the opening list. It is edited for a
quicker pace and a seamless loop, with the phone cropped a little below halfway.
There are no playback controls. Reduced-motion preferences show the opening
frame; playback pauses when off screen or in a hidden tab. The JPEG poster also
provides a still preview when JavaScript or autoplay is unavailable.

The Apple button links to the public TestFlight beta. The Google Play button links
to the Android beta opt-in page at
https://play.google.com/apps/testing/com.musaraj.forumindex.

## Web app

`/app/` is a buildless web preview with the first page of trending discussions and subject tabs, embedded in place of the homepage recording in a same-origin
iframe by default. Use `?q=video` to show the original recording instead.
Both variants start in inert templates, so ordinary visits do not load the video,
and video-mode visits do not load the iframe or call its API. Other query values
(including the previous `?q=v1`) show the live preview. `/app/` also remains directly
accessible. The preview has no bookmarks, reporting, accounts, contributions, subject
reordering, For You feed, or settings. Existing bookmarks from earlier preview
versions are not read or written; users can clear site data to erase those copies.

Topics with `reader_markdown_url` open in a Markdown reader, including server-converted topics. Explicit null opens the original forum; older feeds missing the field retain the `forum.supports_markdown` fallback. The feed proxy exposes only a `reader_source` capability (`native`, `converted`, or null), keeping the converter address server-side. `/api/reader` resolves the topic from an approved feed page before requesting its native URL or the approved topic-specific converter endpoint with `Accept: text/markdown`.
It never accepts an arbitrary target URL, follows redirects, or forwards visitor
credentials. Responses must be Markdown and at most 512 KiB; successful native responses are cached for at most one hour unless marked private or no-store. Converted content is revalidated on every open. `Retry-After` (seconds or HTTP date) is forwarded on failures and gates further upstream requests through an edge cooldown shared by reader requests to the same origin. As with feed caching, eviction or a different data center can bypass this best-effort cooldown. Unsupported forums open externally, and reader
failures offer an “Open on forum” link. The preview shows the returned page, not all subsequent reply pages; generated pagination links are removed using the reader URL as their base. “Open on forum” and discussion links keep the original topic URL. Embedded post images are shown as their alt text. Post headers follow the iOS
reader: 28px circular avatars, semibold usernames, and muted relative dates,
updated locally every minute. Full dates are available as tooltips and accessible
labels. Avatars load from public HTTPS image hosts without a referrer.

Markdown is rendered with the vendored markdown-it browser distribution in
`public/app/vendor/` (license alongside it), with HTML disabled and only HTTPS
links enabled. No package install or build step is required. The app's CSP permits
only same-origin framing; other pages still disallow framing.

The reader follows the mobile apps' shared colors (`#FAF6EE` / `#1C1C1A`, teal
accents), 18px semibold titles, 36px forum icons, underlined subject tabs, and compact
metadata. The header (subject tabs, or Back controls and the forum name in the reader) stays sticky, and a translucent
65%-opaque green bottom bar with white text and backdrop blur explains the preview limitations. There is no subject dropdown or
load-more control. Dark mode follows the system preference. Forum icons load from public
HTTPS image hosts without a referrer; icons hosted on the backend use a globe
fallback to avoid browser calls to that host.

Feed requests from the browser only call `/api/feed`. The Pages Function in `functions/api/feed.js`
calls the public v2 backend API, strips unused fields, and caches successful
responses with Cloudflare's Cache API for at most 3,600 seconds. Browser responses
use `no-store`, so a browser cannot extend an edge entry's lifetime. Expired data
is never served as an error fallback. Cache keys normalize parameters; only
trending feeds, subject navigation, and pages 1–100 are allowed. Client cookies
and authorization headers are not forwarded.

This is an on-demand, per-data-center cache, not a global hourly snapshot. Cold
data centers, eviction, and simultaneous cache misses can cause additional origin
requests. A scheduled Worker with shared storage would be the next step if a
strict global backend request budget is needed. GitHub Actions is not required.

### Cloudflare setup

In the existing Pages project's **Settings → Variables and Secrets**, add an
encrypted secret named `FORUM_API_URL` with the backend HTTPS base URL, without
`/api/v2` or query parameters. Configure production and preview separately, then
redeploy. Do not place the value in `public/`, Git, or client JavaScript. Hiding the
configured URL is not backend authentication; the existing public API remains
public. The current build command and output directory can stay unchanged.
Cloudflare discovers `functions/` during the Pages build; `public/_routes.json`
limits Function invocations to `/api/*`.

For a full local preview, install/use the Cloudflare Wrangler CLI, put
`FORUM_API_URL="https://your-backend.example"` in a root `.dev.vars` file (ignored
by Git), then run `npx wrangler pages dev public` and open `/app/` on the printed
local URL. The Python static server previews markup only; it cannot run the API.
Run proxy regression tests with `npm test` (Node 20+; no dependencies).

References: [Pages secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets)
and [Cache API behavior](https://developers.cloudflare.com/workers/runtime-apis/cache/).

## Privacy policy

The homepage links to `public/privacy/index.html`, served at `/privacy/`.
The policy reflects the backend's [published privacy information](https://do3.musaraj.com/api/v2/privacy),
version `2026-10-06`. Keep the website wording in sync with that source when data
collection, retention, providers, or deletion behavior changes.

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
