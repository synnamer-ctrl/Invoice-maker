# Invoice-maker

An empty Progressive Web App (PWA) starter for Invoice Maker. It uses plain HTML, CSS and JS, with no build step and no dependencies.

## Structure

```
index.html              App shell
manifest.webmanifest    PWA manifest (name, icons, colors, display mode)
sw.js                   Service worker (offline caching)
css/styles.css          Base styles (light/dark)
js/app.js               SW registration, install button, online/offline status
icons/                  SVG + PNG icons (192, 512, maskable, apple-touch)
```

## Run locally

Service workers need `localhost` or HTTPS:

```bash
python3 -m http.server 8080
# or
npx serve .
```

Open http://localhost:8080.

## Notes

- **Caching:** the service worker fetches pages from the network first and falls back to the cached shell offline. Static assets are served from the cache first.
- **Updating:** when you change cached files, bump `CACHE_VERSION` in `sw.js`. Add new static files to `PRECACHE_URLS`.
- **Install:** an "Install" button appears when the browser offers installation.
- **Deploy:** works on any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages). All paths are relative, so it also works from a subpath like `/Invoice-maker/`.
