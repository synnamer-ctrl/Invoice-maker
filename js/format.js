// Formatting and totals shared by the editor preview and the history list.

export function num(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function computeTotals(doc) {
  const subtotal = doc.items.reduce((sum, item) => sum + num(item.qty) * num(item.price), 0);
  const tax = subtotal * num(doc.taxRate) / 100;
  const delivery = num(doc.deliveryCharge);
  return { subtotal, tax, delivery, total: subtotal + tax + delivery };
}

export function moneyFormatter(currency) {
  try {
    const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' });
    return (n) => fmt.format(n);
  } catch {
    return (n) => n.toFixed(2);
  }
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function multiline(value) {
  return esc(value).replace(/\n/g, '<br>');
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { dateStyle: 'medium' });
}
