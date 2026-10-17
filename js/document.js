import { computeTotals, esc, formatDate, moneyFormatter, multiline, num } from './format.js';
import { inHistory, putInHistory } from './history.js';
import { load, newId, save } from './storage.js';

const DRAFT_KEY = 'draft';
const COUNTERS_KEY = 'counters';
const NUMBER_PREFIX = { invoice: 'INV-', receipt: 'RCT-' };
const DUE_IN_DAYS = 14;

const form = document.getElementById('doc-form');
const itemsBody = document.getElementById('items-body');
const itemsTable = document.getElementById('items-table');
const itemsLegend = document.getElementById('items-legend');
const picker = document.getElementById('product-picker');
const pickerEmpty = document.getElementById('picker-empty');
const productSearch = document.getElementById('product-search');
const docEl = document.getElementById('doc');
const companyHint = document.getElementById('company-hint');
const historyNote = document.getElementById('history-note');
const saveBtn = document.getElementById('save-doc');

// Draft fields bound to same-named form inputs.
const FIELDS = ['number', 'date', 'dueDate', 'paymentMethod', 'clientName', 'clientDetails', 'taxRate', 'deliveryCharge', 'notes'];

// Show a search box once the catalog gets long.
const SEARCH_THRESHOLD = 6;

let company = null;
let products = [];
let draft = null;

export function initDocument(initialCompany, initialProducts) {
  company = initialCompany;
  products = initialProducts;
  const saved = load(DRAFT_KEY, null);
  draft = Array.isArray(saved?.items) ? saved : newDraft('invoice');

  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', onInput);
  form.addEventListener('keydown', onKeydown);
  picker.addEventListener('change', onPickerToggle);
  picker.addEventListener('input', onPickerQty);
  picker.addEventListener('click', onPickerStep);
  productSearch.addEventListener('input', renderPicker);
  itemsBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (btn) removeItem(Number(btn.closest('tr').dataset.index));
  });
  document.getElementById('add-item').addEventListener('click', addItem);
  document.getElementById('new-doc').addEventListener('click', startNew);
  document.getElementById('print-doc').addEventListener('click', printDoc);
  saveBtn.addEventListener('click', saveDocument);

  fillForm();
  update();
}

export function setProducts(next) {
  products = next;
  // Once there is a catalog, the empty starter row is no longer needed.
  if (products.length) draft.items = draft.items.filter((item) => !isBlankCustom(item));
  // Keep picked items in step with edits to the catalog, but leave
  // documents already saved in history at the prices they were issued with.
  for (const item of draft.id ? [] : draft.items) {
    const product = productById(item.productId);
    if (product) Object.assign(item, { description: product.name, details: product.details ?? '', price: product.price });
  }
  renderPicker();
  renderItems();
  update();
}

// Load a history document into the editor. With duplicate, start a new
// unsaved document with the same customer and items. Returns false if the
// user chose to keep the current unsaved document.
export function openDocument(doc, { duplicate = false } = {}) {
  if (!draft.id && hasContent() && !confirm('Discard the current unsaved document?')) return false;
  if (duplicate) {
    draft = {
      ...newDraft(doc.type),
      clientName: doc.clientName,
      clientDetails: doc.clientDetails,
      // A new sale uses today's catalog prices.
      items: doc.items.map((item) => {
        const product = productById(item.productId);
        return product
          ? { ...item, description: product.name, details: product.details ?? '', price: product.price }
          : { ...item };
      }),
      taxRate: doc.taxRate,
      deliveryCharge: doc.deliveryCharge ?? '',
      paymentMethod: doc.paymentMethod,
      notes: doc.notes,
    };
  } else {
    draft = structuredClone(doc);
  }
  fillForm();
  update();
  return true;
}

export function setCompany(next) {
  company = next;
  renderPicker(); // prices show in the company currency
  update();
}

// Fill in company defaults where the current draft has none yet.
export function applyCompanyDefaults(next) {
  company = next;
  if (draft.taxRate === '' || draft.taxRate == null) draft.taxRate = company.taxRate ?? '';
  if (!draft.notes) draft.notes = company.notes ?? '';
  fillForm();
  update();
}

// ---- State ----------------------------------------------------------------

function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

function nextNumber(type) {
  const counters = load(COUNTERS_KEY, {});
  return NUMBER_PREFIX[type] + String((counters[type] ?? 0) + 1).padStart(4, '0');
}

// Remember the highest number printed so the next document continues from it.
function markNumberUsed(type, number) {
  const n = parseInt(number.match(/(\d+)\s*$/)?.[1] ?? '', 10);
  if (!Number.isFinite(n)) return;
  const counters = load(COUNTERS_KEY, {});
  if (n > (counters[type] ?? 0)) {
    counters[type] = n;
    save(COUNTERS_KEY, counters);
  }
}

function newDraft(type) {
  return {
    type,
    number: nextNumber(type),
    date: today(),
    dueDate: today(DUE_IN_DAYS),
    paymentMethod: '',
    clientName: '',
    clientDetails: '',
    items: products.length ? [] : [blankItem()],
    taxRate: company?.taxRate ?? '',
    deliveryCharge: '',
    notes: company?.notes ?? '',
  };
}

function productById(id) {
  return id ? products.find((p) => p.id === id) : undefined;
}

function pickedItem(productId) {
  return draft.items.find((item) => item.productId === productId);
}

// Items typed by hand, plus picked items whose product has since been deleted.
function isCustom(item) {
  return !productById(item.productId);
}

function isBlankCustom(item) {
  return !item.productId && !item.description.trim() && !num(item.price);
}

function blankItem() {
  return { description: '', qty: '1', price: '' };
}

function hasContent() {
  return Boolean(draft.clientName) || draft.items.some((i) => i.description || num(i.price));
}

// ---- Editor ---------------------------------------------------------------

function fillForm() {
  const { elements } = form;
  for (const radio of elements.type) radio.checked = radio.value === draft.type;
  for (const field of FIELDS) {
    elements[field].value = draft[field] ?? '';
  }
  renderPicker();
  renderItems();
}

// ---- Product picker -------------------------------------------------------

function renderPicker() {
  pickerEmpty.hidden = products.length > 0;
  productSearch.hidden = products.length <= SEARCH_THRESHOLD;
  const query = productSearch.hidden ? '' : productSearch.value.trim().toLowerCase();
  picker.replaceChildren(...products
    .filter((p) => p.name.toLowerCase().includes(query))
    .map((product) => {
      const li = document.createElement('li');
      li.dataset.id = product.id;
      li.innerHTML = `
        <label class="pick">
          <input type="checkbox">
          <span class="pick-text">
            <span class="pick-name"></span>
            <span class="pick-price"></span>
            <span class="pick-details"></span>
          </span>
        </label>
        <div class="stepper">
          <button type="button" data-step="-1" aria-label="Decrease">&minus;</button>
          <input type="number" min="0" step="any" inputmode="decimal" placeholder="0">
          <button type="button" data-step="1" aria-label="Increase">+</button>
        </div>`;
      li.querySelector('.pick-name').textContent = product.name;
      li.querySelector('.pick-details').textContent = product.details ?? '';
      li.querySelector('.stepper input').setAttribute('aria-label', `Quantity of ${product.name}`);
      syncPickerRow(li);
      return li;
    }));
}

function syncPickerRow(li) {
  const item = pickedItem(li.dataset.id);
  li.classList.toggle('picked', Boolean(item));
  li.querySelector('input[type=checkbox]').checked = Boolean(item);
  // A picked item keeps the price it was added at.
  li.querySelector('.pick-price').textContent = moneyFormatter(company?.currency)(num(item?.price ?? productById(li.dataset.id).price));
  const qtyInput = li.querySelector('.stepper input');
  if (document.activeElement !== qtyInput) qtyInput.value = item?.qty ?? '';
}

function setPicked(productId, qty) {
  const item = pickedItem(productId);
  if (qty === null) {
    draft.items = draft.items.filter((i) => i !== item);
  } else if (item) {
    item.qty = qty;
  } else {
    const product = productById(productId);
    draft.items.push({ productId, description: product.name, details: product.details ?? '', qty, price: product.price });
  }
  syncPickerRow(picker.querySelector(`li[data-id="${CSS.escape(productId)}"]`));
  update();
}

function onPickerToggle(e) {
  if (e.target.type !== 'checkbox') return;
  setPicked(e.target.closest('li').dataset.id, e.target.checked ? '1' : null);
}

function onPickerQty(e) {
  if (!e.target.closest('.stepper')) return;
  const { id } = e.target.closest('li').dataset;
  const { value } = e.target;
  if (value === '') {
    // Mid-edit: keep the product picked until a quantity is entered.
    if (pickedItem(id)) setPicked(id, '');
  } else {
    setPicked(id, num(value) > 0 ? value : null);
  }
}

function onPickerStep(e) {
  const btn = e.target.closest('[data-step]');
  if (!btn) return;
  const { id } = btn.closest('li').dataset;
  const next = Math.max(0, num(pickedItem(id)?.qty) + Number(btn.dataset.step));
  setPicked(id, next > 0 ? String(next) : null);
}

function renderItems() {
  const rows = draft.items.map((item, index) => [item, index]).filter(([item]) => isCustom(item));
  itemsTable.hidden = rows.length === 0;
  itemsLegend.textContent = products.length ? 'Other items' : 'Items';
  itemsBody.replaceChildren(...rows.map(([item, index]) => {
    const tr = document.createElement('tr');
    tr.dataset.index = index;
    tr.innerHTML = `
      <td><input data-field="description" aria-label="Description" placeholder="Item or service"></td>
      <td><input data-field="qty" aria-label="Quantity" type="number" min="0" step="any" inputmode="decimal"></td>
      <td><input data-field="price" aria-label="Price" type="number" min="0" step="any" inputmode="decimal" placeholder="0.00"></td>
      <td class="num amount-col" data-amount></td>
      <td><button type="button" class="icon-btn" data-remove aria-label="Remove item">&times;</button></td>`;
    for (const input of tr.querySelectorAll('input')) input.value = item[input.dataset.field];
    return tr;
  }));
}

function onInput(e) {
  const target = e.target;
  if (target.closest('#product-picker') || target === productSearch) return;
  const row = target.closest('tr[data-index]');
  if (row) {
    draft.items[row.dataset.index][target.dataset.field] = target.value;
  } else if (target.name === 'type') {
    switchType(target.value);
  } else if (FIELDS.includes(target.name)) {
    draft[target.name] = target.value;
  }
  update();
}

// Enter on the last item row adds a new row, for fast entry.
function onKeydown(e) {
  if (e.key !== 'Enter') return;
  const row = e.target.closest('tr[data-index]');
  if (!row) return;
  e.preventDefault();
  if (row.nextElementSibling) row.nextElementSibling.querySelector('input').focus();
  else addItem();
}

function switchType(type) {
  // Keep a hand-typed number; replace only the auto-generated one.
  if (draft.number === nextNumber(draft.type)) draft.number = nextNumber(type);
  draft.type = type;
  form.elements.number.value = draft.number;
}

function addItem() {
  draft.items.push(blankItem());
  renderItems();
  update();
  itemsBody.lastElementChild.querySelector('input').focus();
}

function removeItem(index) {
  draft.items.splice(index, 1);
  if (!products.length && !draft.items.some(isCustom)) draft.items.push(blankItem());
  renderItems();
  update();
}

function startNew() {
  if (!draft.id && hasContent() && !confirm('Start a new document? The current one is not saved and will be cleared.')) return;
  draft = newDraft(draft.type);
  fillForm();
  update();
}

function saveDocument() {
  const isNew = !draft.id;
  if (isNew) {
    draft.id = newId();
    draft.savedAt = new Date().toISOString();
  }
  if (!putInHistory(draft)) {
    if (isNew) delete draft.id;
    alert('Could not save. Storage on this device is full or blocked.');
    return false;
  }
  markNumberUsed(draft.type, draft.number);
  update();
  return true;
}

function printDoc() {
  if (!saveDocument()) return;
  // The document title becomes the default PDF file name.
  const title = document.title;
  document.title = [draft.number, draft.clientName].filter(Boolean).join(' ');
  window.addEventListener('afterprint', () => { document.title = title; }, { once: true });
  window.print();
}

function update() {
  // Documents opened from history save back to it as they are edited.
  if (draft.id) {
    if (!inHistory(draft.id)) {
      delete draft.id; // deleted from history meanwhile
      delete draft.savedAt;
    } else if (!putInHistory(draft)) {
      alert('Could not save changes. Storage on this device is full or blocked.');
    }
  }
  save(DRAFT_KEY, draft);
  saveBtn.hidden = Boolean(draft.id);
  historyNote.hidden = !draft.id;
  form.dataset.type = draft.type;
  companyHint.hidden = Boolean(company?.name);

  const money = moneyFormatter(company?.currency);
  [...itemsBody.children].forEach((tr) => {
    const item = draft.items[tr.dataset.index];
    tr.querySelector('[data-amount]').textContent = money(num(item.qty) * num(item.price));
  });

  renderPreview(money);
}

// ---- Preview --------------------------------------------------------------

function renderPreview(money) {
  const c = company ?? {};
  const isReceipt = draft.type === 'receipt';
  const items = draft.items.filter((i) => i.description.trim() || num(i.price));
  const { subtotal, tax, delivery, total } = computeTotals(draft);
  const contact = [c.email, c.phone].filter(Boolean).map(esc).join(' &middot; ');

  const meta = [
    [isReceipt ? 'Receipt no.' : 'Invoice no.', draft.number],
    ['Date', formatDate(draft.date)],
    isReceipt ? ['Paid by', draft.paymentMethod] : ['Due', formatDate(draft.dueDate)],
  ].filter(([, value]) => value);

  docEl.innerHTML = `
    <header class="doc-head">
      <div class="doc-company">
        ${c.logo ? `<img class="doc-logo" src="${esc(c.logo)}" alt="">` : ''}
        <div class="doc-company-name ${c.name ? '' : 'placeholder'}">${esc(c.name || 'Your company')}</div>
        ${c.regNo ? `<div>Reg. no. ${esc(c.regNo)}</div>` : ''}
        ${c.taxId ? `<div>Tax ID ${esc(c.taxId)}</div>` : ''}
        ${c.address ? `<div>${multiline(c.address)}</div>` : ''}
        ${contact ? `<div>${contact}</div>` : ''}
      </div>
      <div class="doc-title">
        <h2>${isReceipt ? 'Receipt' : 'Invoice'}</h2>
        <dl>${meta.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      </div>
    </header>

    ${draft.clientName || draft.clientDetails ? `
    <section class="doc-bill">
      <h3>${isReceipt ? 'Received from' : 'Bill to'}</h3>
      ${draft.clientName ? `<div class="doc-client-name">${esc(draft.clientName)}</div>` : ''}
      ${draft.clientDetails ? `<div>${multiline(draft.clientDetails)}</div>` : ''}
    </section>` : ''}

    <table class="doc-items">
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${items.length ? items.map((i) => `
          <tr>
            <td>${esc(i.description)}${i.details ? `<div class="doc-item-details">${multiline(i.details)}</div>` : ''}</td>
            <td class="num">${esc(num(i.qty))}</td>
            <td class="num">${money(num(i.price))}</td>
            <td class="num">${money(num(i.qty) * num(i.price))}</td>
          </tr>`).join('') : '<tr><td colspan="4" class="placeholder">No items yet</td></tr>'}
      </tbody>
    </table>

    <dl class="doc-totals">
      ${num(draft.taxRate) || delivery ? `<dt>Subtotal</dt><dd>${money(subtotal)}</dd>` : ''}
      ${num(draft.taxRate) ? `<dt>Tax (${esc(num(draft.taxRate))}%)</dt><dd>${money(tax)}</dd>` : ''}
      ${delivery ? `<dt>Delivery</dt><dd>${money(delivery)}</dd>` : ''}
      <dt class="grand">${isReceipt ? 'Total paid' : 'Total due'}</dt><dd class="grand">${money(total)}</dd>
    </dl>

    ${draft.notes ? `<section class="doc-notes">${multiline(draft.notes)}</section>` : ''}`;
}
