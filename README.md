# Forum Index website

A small, dependency-free landing page for the Forum Index iOS and Android apps.
Production domain: https://theforumindex.com.

## Local preview

Run `python3 -m http.server 8080 --directory public` and open http://localhost:8080.
Edit `public/index.html` and `public/styles.css` directly; no build is required.
The logo and icon come from the adjacent `forum-index-app` repository.
The angled app preview uses an AI-edited mock screenshot with fictional technology
topics, rather than real forum content or personal reading activity.

The store buttons are intentionally inert and use `aria-disabled="true"` so they
remain keyboard-focusable for their tooltips. Add real store links when released.

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
