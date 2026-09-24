# Forum Index website

A small, dependency-free landing page for the Forum Index iOS and Android apps.
Production domain: https://theforumindex.com.

## Local preview

Run `python3 -m http.server 8080 --directory public` and open http://localhost:8080.
Edit `public/index.html` and `public/styles.css` directly; no build is required.
The logo and icon come from the adjacent `forum-index-app` repository.

The store buttons are intentionally inert and use `aria-disabled="true"` so they
remain keyboard-focusable for their tooltips. Add real store links when released.

## Cloudflare Pages

The `forum-index-website` Pages project is connected through Cloudflare's native
GitHub integration. Pushes to `main` automatically deploy production; other
branches receive preview deployments. No GitHub Actions workflow or API secret
is needed. Project settings:

| Setting | Value |
| --- | --- |
| Repository | `pmusaraj/forum-index-website` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `exit 0` |
| Build output directory | `public` |

Pages URL: https://forum-index-website.pages.dev.

`theforumindex.com` is associated with the Pages project. Its Cloudflare DNS zone
must have a proxied `CNAME` record named `@` targeting
`forum-index-website.pages.dev`. The CLI OAuth session used for setup has Pages
permissions but cannot manage DNS, so this record must be confirmed in the
Cloudflare dashboard. Pages provisions HTTPS after domain validation.

References: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
and [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
