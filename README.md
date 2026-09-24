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

Use Cloudflare Pages' native GitHub integration with these settings:

| Setting | Value |
| --- | --- |
| Repository | `pmusaraj/forum-index-website` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `exit 0` |
| Build output directory | `public` |

In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git**,
select the repository, and apply these settings. If prompted, authorize the
Cloudflare GitHub app for this repository. Pushes to `main` will deploy production;
other branches get preview deployments. No GitHub Actions workflow or API secret
is needed.

After the first deployment, open **Custom domains → Set up a custom domain** and
add `theforumindex.com`. Since the zone is already in Cloudflare, confirm the DNS
record Cloudflare proposes. Associate the domain with Pages before adding a DNS
record manually.

References: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
and [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
