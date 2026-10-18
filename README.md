# Invoice-maker

A fast invoice and receipt maker that installs as an app (PWA) and works offline. It uses plain HTML, CSS and JS, with no build step and no dependencies.

## Features

- **Company profile:** logo, company name, registration number, tax ID, address, contact details, currency (any currency), default tax rate and notes. Changes save automatically on the device.
- **Products:** set up products with optional details and prices once. When making a document, tick the products and enter quantities (or use +/−). One-off items can still be typed in.
- **Invoices and receipts:** switch type with one tap. Numbers count up automatically (`INV-0001`, `INV-0002`…, `RCT-0001`…): after Save or Print, the next document starts with the next number.
- **Fast entry:** live preview, automatic totals with tax and delivery charge, and Enter on an item row adds the next row.
- **History:** Save or Print adds the document to History. Open any past invoice or receipt to edit it (changes save automatically), duplicate it for a repeat customer, or delete it.
- **Share PDF:** makes the PDF on the phone and opens the share sheet (WhatsApp, email, Drive...). Works offline. On browsers that can't share files, it downloads the PDF instead.
- **Print / Save PDF:** prints only the document on A4. The PDF file name defaults to the document number and customer name.
- **Auto-save:** the current document is kept if the app is closed.

## Where data is stored

Everything stays on the phone:

- Company details, products, the current draft and history are kept in the browser's `localStorage` on the device. The app asks the browser to keep this storage permanently (`navigator.storage.persist()`).
- **Print / Save PDF** opens the phone's print/share sheet, and the PDF is saved wherever the user chooses (Files, Downloads, WhatsApp, etc.).
- Nothing is sent to a server or to GitHub. The repository only holds the app's code, which a static host serves so the app can be installed.

Clearing the browser's site data or uninstalling the app deletes the saved data.

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
js/history.js           Saved invoices/receipts list
js/format.js            Totals and number/date formatting
js/share.js             PDF building (html2canvas + jsPDF) and sharing
vendor/                 Third-party libraries served with the app (MIT)
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

- **Caching:** the service worker always fetches from the network first (revalidating, so the page, styles and scripts come from the same deployed version) and falls back to the cache when offline.
- **Updating:** when you change cached files, bump `CACHE_VERSION` in `sw.js`. Add new static files to `PRECACHE_URLS`.
- **Install:** an "Install" button appears when the browser offers installation.
- **Deploy:** works on any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages). All paths are relative, so it also works from a subpath like `/Invoice-maker/`.
