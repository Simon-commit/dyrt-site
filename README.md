# dyrt

Source for the dyrt website, the studio behind [RoLens](https://github.com/Simon-commit/rolens).

The site is plain static HTML with no build step. It is served by Cloudflare Workers as static assets, and every push to `main` is deployed automatically.

## Files

- `public/index.html`: the page, with its styles inline.
- `public/favicon.svg`: the browser tab icon.
- `wrangler.jsonc`: tells Cloudflare to serve the `public` folder.

## Local preview

Open `public/index.html` in a browser, or run `python3 -m http.server` in the `public` folder and visit http://localhost:8000.
