# Invoice-maker

A fast invoice and receipt maker that installs as an app (PWA) and works offline. It uses plain HTML, CSS and JS, with no build step and no dependencies.

## Features

- **Company profile:** logo, company name, registration number, tax ID, address, contact details, currency, default tax rate and notes. Saved on the device.
- **Products:** set up products and prices once. When making a document, tick the products and enter quantities (or use +/−). One-off items can still be typed in.
- **Invoices and receipts:** switch type with one tap. Numbers fill in automatically (`INV-0001`, `RCT-0001`) and continue from the last one printed.
- **Fast entry:** live preview, automatic totals with tax and delivery charge, and Enter on an item row adds the next row.
- **Print / Save PDF:** prints only the document on A4. The PDF file name defaults to the document number and customer name.
- **Auto-save:** the current document is kept if the app is closed.

All data stays in the browser's `localStorage` on this device. Nothing is sent to a server.

## Structure

```
index.html              App shell
manifest.webmanifest    PWA manifest (name, icons, colors, display mode)
sw.js                   Service worker (offline caching)
css/styles.css          Base styles (light/dark)
js/app.js               Tab routing, SW registration, install button, online/offline status
js/company.js           Company profile form and logo resizing
js/document.js          Invoice/receipt editor, product picker, numbering and preview
js/products.js          Product catalog (name + price)
js/storage.js           localStorage helpers
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
