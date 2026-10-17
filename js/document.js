import { load, save } from './storage.js';

const DRAFT_KEY = 'draft';
const COUNTERS_KEY = 'counters';
const NUMBER_PREFIX = { invoice: 'INV-', receipt: 'RCT-' };
const DUE_IN_DAYS = 14;

const form = document.getElementById('doc-form');
const itemsBody = document.getElementById('items-body');
const docEl = document.getElementById('doc');
const companyHint = document.getElementById('company-hint');

let company = null;
let draft = null;

export function initDocument(initialCompany) {
  company = initialCompany;
  const saved = load(DRAFT_KEY, null);
  draft = Array.isArray(saved?.items) ? saved : newDraft('invoice');

  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', onInput);
  form.addEventListener('keydown', onKeydown);
  itemsBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (btn) removeItem(Number(btn.closest('tr').dataset.index));
  });
  document.getElementById('add-item').addEventListener('click', addItem);
  document.getElementById('new-doc').addEventListener('click', startNew);
  document.getElementById('print-doc').addEventListener('click', printDoc);

  fillForm();
  update();
}

export function setCompany(next) {
  company = next;
  // Fill in new company defaults where the current draft has none yet.
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
    items: [blankItem()],
    taxRate: company?.taxRate ?? '',
    notes: company?.notes ?? '',
  };
}

function blankItem() {
  return { description: '', qty: '1', price: '' };
}

function num(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function totals() {
  const subtotal = draft.items.reduce((sum, item) => sum + num(item.qty) * num(item.price), 0);
  const tax = subtotal * num(draft.taxRate) / 100;
  return { subtotal, tax, total: subtotal + tax };
}

// ---- Editor ---------------------------------------------------------------

function fillForm() {
  const { elements } = form;
  for (const radio of elements.type) radio.checked = radio.value === draft.type;
  for (const field of ['number', 'date', 'dueDate', 'paymentMethod', 'clientName', 'clientDetails', 'taxRate', 'notes']) {
    elements[field].value = draft[field] ?? '';
  }
  renderItems();
}

function renderItems() {
  itemsBody.replaceChildren(...draft.items.map((item, index) => {
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
  const row = target.closest('tr[data-index]');
  if (row) {
    draft.items[row.dataset.index][target.dataset.field] = target.value;
  } else if (target.name === 'type') {
    switchType(target.value);
  } else if (target.name in draft) {
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
  if (Number(row.dataset.index) === draft.items.length - 1) addItem();
  else itemsBody.children[Number(row.dataset.index) + 1].querySelector('input').focus();
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
  if (draft.items.length === 0) draft.items.push(blankItem());
  renderItems();
  update();
}

function startNew() {
  const hasContent = draft.clientName || draft.items.some((i) => i.description || num(i.price));
  if (hasContent && !confirm('Start a new document? The current one will be cleared.')) return;
  draft = newDraft(draft.type);
  fillForm();
  update();
}

function printDoc() {
  markNumberUsed(draft.type, draft.number);
  // The document title becomes the default PDF file name.
  const title = document.title;
  document.title = [draft.number, draft.clientName].filter(Boolean).join(' ');
  window.addEventListener('afterprint', () => { document.title = title; }, { once: true });
  window.print();
}

function update() {
  save(DRAFT_KEY, draft);
  form.dataset.type = draft.type;
  companyHint.hidden = Boolean(company?.name);

  const money = moneyFormatter();
  [...itemsBody.children].forEach((tr, i) => {
    const item = draft.items[i];
    tr.querySelector('[data-amount]').textContent = money(num(item.qty) * num(item.price));
  });

  renderPreview(money);
}

// ---- Preview --------------------------------------------------------------

function moneyFormatter() {
  try {
    const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: company?.currency || 'USD' });
    return (n) => fmt.format(n);
  } catch {
    return (n) => n.toFixed(2);
  }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function multiline(value) {
  return esc(value).replace(/\n/g, '<br>');
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function renderPreview(money) {
  const c = company ?? {};
  const isReceipt = draft.type === 'receipt';
  const items = draft.items.filter((i) => i.description.trim() || num(i.price));
  const { subtotal, tax, total } = totals();
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
            <td>${esc(i.description)}</td>
            <td class="num">${esc(num(i.qty))}</td>
            <td class="num">${money(num(i.price))}</td>
            <td class="num">${money(num(i.qty) * num(i.price))}</td>
          </tr>`).join('') : '<tr><td colspan="4" class="placeholder">No items yet</td></tr>'}
      </tbody>
    </table>

    <dl class="doc-totals">
      ${num(draft.taxRate) ? `
        <dt>Subtotal</dt><dd>${money(subtotal)}</dd>
        <dt>Tax (${esc(num(draft.taxRate))}%)</dt><dd>${money(tax)}</dd>` : ''}
      <dt class="grand">${isReceipt ? 'Total paid' : 'Total due'}</dt><dd class="grand">${money(total)}</dd>
    </dl>

    ${isReceipt ? '<div class="doc-stamp">Paid</div>' : ''}
    ${draft.notes ? `<section class="doc-notes">${multiline(draft.notes)}</section>` : ''}`;
}
