# dyrt

Source for [dyrt.io](https://dyrt.io), Simon's portfolio. Projects include [RoLens](https://github.com/Simon-commit/rolens) and Aurora.

The site is static HTML and CSS with one small Cloudflare Worker. Every push to `main` is deployed automatically.

## Structure

- `public/index.html`: the home page with the project catalogue. To add a project, copy one `<li class="project">` block inside `.catalogue`, and add a page for it under `public/<name>/index.html` if it needs one.
- `public/rolens/index.html`: the RoLens project page.
- `public/`: also holds `styles.css`, `app.js`, the 404 page, the favicon, the social preview image and the self-hosted fonts.
- `src/worker.js`: serves `public/` and two read-only endpoints for the example trades on the home page and the RoLens page.
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
