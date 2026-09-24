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

The `forum-index-website` Pages project builds from this GitHub repository.
The workflow in `.github/workflows/deploy.yml` triggers a Pages build on every
push to `main`, using the `CLOUDFLARE_DEPLOY_HOOK` repository secret. The hook is
restricted to deploying this project's `main` branch; no Cloudflare account token
is stored in GitHub. The workflow confirms the build was queued; completion and
build logs are available in the Cloudflare Pages dashboard. Project settings:

| Setting | Value |
| --- | --- |
| Repository | `pmusaraj/forum-index-website` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `exit 0` |
| Build output directory | `public` |

Pages URL: https://forum-index-website.pages.dev.

Native Pages push triggers are disabled to avoid duplicate builds. To deploy
manually, run the **Deploy to Cloudflare Pages** workflow in GitHub Actions.
To rotate the hook, create a new `main` deploy hook in Pages settings and replace
the `CLOUDFLARE_DEPLOY_HOOK` GitHub Actions secret with its URL.

`theforumindex.com` is associated with the Pages project and serves the landing
page over HTTPS. Its Cloudflare DNS zone has a proxied `CNAME` record named `@`
targeting `forum-index-website.pages.dev`. Manage this record in the Cloudflare
dashboard; the CLI OAuth session used for setup does not have DNS permissions.

References: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
and [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
