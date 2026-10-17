import { getCompany, initCompanyForm } from './company.js';
import { initDocument, openDocument, setCompany, setProducts } from './document.js';
import { initHistory, renderHistory } from './history.js';
import { getProducts, initProducts } from './products.js';

const statusEl = document.getElementById('status');
const installBtn = document.getElementById('install-btn');

// App setup and hash routing (#create, #company)
const views = {
  create: document.getElementById('view-create'),
  history: document.getElementById('view-history'),
  products: document.getElementById('view-products'),
  company: document.getElementById('view-company'),
};

function route() {
  const name = location.hash.slice(1);
  const current = name in views ? name : 'create';
  for (const [key, el] of Object.entries(views)) el.hidden = key !== current;
  for (const link of document.querySelectorAll('.tabs a')) {
    if (link.dataset.view === current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (current === 'history') renderHistory();
}

const company = getCompany();
initDocument(company, getProducts());
initProducts(setProducts);
initHistory({
  onOpen: (doc) => { if (openDocument(doc)) location.hash = '#create'; },
  onDuplicate: (doc) => { if (openDocument(doc, { duplicate: true })) location.hash = '#create'; },
});
initCompanyForm((saved) => {
  setCompany(saved);
  // First-time setup continues with the product list.
  location.hash = getProducts().length ? '#create' : '#products';
});

// First run: ask for company details before anything else.
if (!company && !location.hash) location.hash = '#company';
window.addEventListener('hashchange', route);
route();

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');

      // Reload once a new service worker replaces the old one. On the very first
      // install there is no old worker, so there is nothing stale to reload.
      const hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    } catch (err) {
      console.error('Service worker registration failed:', err);
    }
  });
}

// Install prompt
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  installBtn.hidden = true;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});

window.addEventListener('appinstalled', () => {
  installBtn.hidden = true;
  deferredPrompt = null;
});

// Online / offline indicator
function updateOnlineStatus() {
  statusEl.textContent = navigator.onLine ? 'Online' : 'Offline';
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();
