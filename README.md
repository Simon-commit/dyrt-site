# dyrt

Source for [dyrt.io](https://dyrt.io), the studio site behind [RoLens](https://github.com/Simon-commit/rolens).

The site is static HTML and CSS with one small Cloudflare Worker. Every push to `main` is deployed automatically.

## Structure

- `public/`: the site. `index.html`, `styles.css`, `app.js`, the 404 page, the favicon, the social preview image and the self-hosted fonts.
- `src/worker.js`: serves `public/` and two read-only endpoints for the example trade on the home page.
  - `GET /api/values` returns the current Rolimon's value, RAP and demand for the three showcased items.
  - `GET /api/thumb/:id` returns an item's Roblox thumbnail, for those three items only.

  Both are cached at the edge (values for 10 minutes, images for a day), so Rolimon's and Roblox see at most one request per cache period.
- `public/_headers`: security headers, including a strict Content Security Policy.
- `wrangler.jsonc`: Worker configuration and the dyrt.io domains.

## Privacy

The site sets no cookies, runs no analytics and loads nothing from third parties. Fonts are served from this site, and item images are fetched by the Worker, so visitors never contact Roblox or Rolimon's.

## Local development

```sh
npx wrangler dev
```

## Fonts

Bricolage Grotesque, Geist and Geist Mono, under the SIL Open Font License 1.1. Licence texts are in `public/fonts/`.
