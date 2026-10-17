import { load, save } from './storage.js';

const KEY = 'company';
const CURRENCIES = ['USD', 'EUR', 'GBP', 'MYR', 'SGD', 'IDR', 'PHP', 'THB', 'INR', 'AUD', 'CAD', 'JPY', 'AED', 'SAR'];

// Logos are downscaled before saving so they fit comfortably in localStorage.
const LOGO_MAX_WIDTH = 600;
const LOGO_MAX_HEIGHT = 300;

export function getCompany() {
  return load(KEY, null);
}

export function initCompanyForm(onSaved) {
  const form = document.getElementById('company-form');
  const logoPreview = document.getElementById('logo-preview');
  const removeLogoBtn = document.getElementById('remove-logo');
  const savedMsg = document.getElementById('company-saved');
  const { elements } = form;
  let logo = '';

  for (const code of CURRENCIES) elements.currency.add(new Option(code, code));

  function showLogo() {
    logoPreview.replaceChildren();
    if (logo) {
      const img = new Image();
      img.src = logo;
      img.alt = 'Company logo';
      logoPreview.append(img);
    } else {
      logoPreview.textContent = 'No logo';
    }
    removeLogoBtn.hidden = !logo;
  }

  const company = getCompany() ?? { currency: guessCurrency(), taxRate: 0 };
  for (const field of ['name', 'regNo', 'taxId', 'address', 'email', 'phone', 'currency', 'taxRate', 'notes']) {
    if (company[field] != null) elements[field].value = company[field];
  }
  logo = company.logo ?? '';
  showLogo();

  elements.logoFile.addEventListener('change', async () => {
    const file = elements.logoFile.files[0];
    elements.logoFile.value = '';
    if (!file) return;
    try {
      logo = await resizeImage(file, LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT);
      showLogo();
      savedMsg.textContent = 'Unsaved changes';
    } catch {
      alert('Could not read that image. Try a PNG, JPG or SVG file.');
    }
  });

  removeLogoBtn.addEventListener('click', () => {
    logo = '';
    showLogo();
    savedMsg.textContent = 'Unsaved changes';
  });

  form.addEventListener('input', () => { savedMsg.textContent = 'Unsaved changes'; });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const saved = {
      logo,
      name: elements.name.value.trim(),
      regNo: elements.regNo.value.trim(),
      taxId: elements.taxId.value.trim(),
      address: elements.address.value.trim(),
      email: elements.email.value.trim(),
      phone: elements.phone.value.trim(),
      currency: elements.currency.value,
      taxRate: elements.taxRate.value,
      notes: elements.notes.value.trim(),
    };
    if (!save(KEY, saved)) {
      savedMsg.textContent = 'Could not save. Storage is full or blocked.';
      return;
    }
    savedMsg.textContent = 'Saved';
    onSaved(saved);
  });
}

function guessCurrency() {
  const region = new Intl.Locale(navigator.language).maximize().region;
  const byRegion = {
    US: 'USD', GB: 'GBP', MY: 'MYR', SG: 'SGD', ID: 'IDR', PH: 'PHP', TH: 'THB', IN: 'INR',
    AU: 'AUD', CA: 'CAD', JP: 'JPY', AE: 'AED', SA: 'SAR',
    DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', BE: 'EUR', FI: 'EUR',
  };
  return byRegion[region] ?? 'USD';
}

function resizeImage(file, maxWidth, maxHeight) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // SVGs without explicit dimensions report 0x0.
      const srcW = img.naturalWidth || maxWidth;
      const srcH = img.naturalHeight || maxHeight;
      const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(srcW * scale));
      canvas.height = Math.max(1, Math.round(srcH * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image'));
    };
    img.src = url;
  });
}
