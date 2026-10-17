import { getCompany } from './company.js';
import { computeTotals, esc, formatDate, moneyFormatter } from './format.js';
import { load, save } from './storage.js';

const KEY = 'history';
let history = load(KEY, []);

const list = document.getElementById('history-list');
const empty = document.getElementById('history-empty');
const search = document.getElementById('history-search');

export function inHistory(id) {
  return history.some((doc) => doc.id === id);
}

// Add or replace a document. Returns false when storage is full or blocked.
export function putInHistory(doc) {
  const entry = { ...structuredClone(doc), updatedAt: new Date().toISOString() };
  const index = history.findIndex((d) => d.id === doc.id);
  const next = index >= 0 ? history.with(index, entry) : [entry, ...history];
  if (!save(KEY, next)) return false;
  history = next;
  return true;
}

export function initHistory({ onOpen, onDuplicate }) {
  search.addEventListener('input', renderHistory);
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const doc = history.find((d) => d.id === li.dataset.id);
    if (e.target.closest('[data-delete]')) {
      if (!confirm(`Delete ${doc.number}? This cannot be undone.`)) return;
      history = history.filter((d) => d !== doc);
      save(KEY, history);
      renderHistory();
    } else if (e.target.closest('[data-duplicate]')) {
      onDuplicate(doc);
    } else if (e.target.closest('[data-open]')) {
      onOpen(doc);
    }
  });
}

export function renderHistory() {
  const money = moneyFormatter(getCompany()?.currency);
  const query = search.value.trim().toLowerCase();
  const docs = [...history]
    .sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))
    .filter((d) => `${d.number} ${d.clientName}`.toLowerCase().includes(query));

  empty.hidden = docs.length > 0;
  empty.textContent = history.length ? 'No matches.' : 'Nothing saved yet. Invoices and receipts appear here after you save or print them.';
  search.hidden = history.length === 0;

  list.innerHTML = docs.map((doc) => `
    <li data-id="${esc(doc.id)}">
      <button type="button" class="history-open" data-open aria-label="Open ${doc.type === 'receipt' ? 'receipt' : 'invoice'} ${esc(doc.number)}">
        <span class="history-line">
          <strong class="history-number">${esc(doc.number)}</strong>
          <span class="history-date muted">${esc(formatDate(doc.date))}</span>
        </span>
        <span class="history-line">
          <span class="history-client muted">${esc(doc.clientName || 'No customer')}</span>
          <span class="history-total">${money(computeTotals(doc).total)}</span>
        </span>
      </button>
      <div class="history-actions">
        <button type="button" class="icon-btn icon-btn-plain" data-duplicate aria-label="Duplicate ${esc(doc.number)}" title="Duplicate">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button type="button" class="icon-btn" data-delete aria-label="Delete ${esc(doc.number)}">&times;</button>
      </div>
    </li>`).join('');
}
