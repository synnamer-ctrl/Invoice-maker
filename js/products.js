import { load, save } from './storage.js';

const KEY = 'products';
let products = load(KEY, []);

export function getProducts() {
  return products;
}

function newId() {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function initProducts(onChange) {
  const form = document.getElementById('product-form');
  const list = document.getElementById('product-list');
  const empty = document.getElementById('products-empty');

  function persist() {
    save(KEY, products);
    onChange(products);
  }

  function render() {
    empty.hidden = products.length > 0;
    list.replaceChildren(...products.map((product) => {
      const li = document.createElement('li');
      li.dataset.id = product.id;
      li.innerHTML = `
        <input data-field="name" aria-label="Product name" required>
        <input data-field="price" aria-label="Price" type="number" min="0" step="any" inputmode="decimal">
        <button type="button" class="icon-btn" data-delete aria-label="Delete product">&times;</button>`;
      li.querySelector('[data-field=name]').value = product.name;
      li.querySelector('[data-field=price]').value = product.price;
      return li;
    }));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) return;
    products = [...products, { id: newId(), name, price: form.elements.price.value }];
    persist();
    render();
    form.reset();
    form.elements.name.focus();
  });

  // Edits in the list save as you type.
  list.addEventListener('input', (e) => {
    const { id } = e.target.closest('li').dataset;
    const field = e.target.dataset.field;
    products = products.map((p) => (p.id === id ? { ...p, [field]: field === 'name' ? e.target.value.trim() : e.target.value } : p));
    persist();
  });

  list.addEventListener('click', (e) => {
    if (!e.target.closest('[data-delete]')) return;
    const { id } = e.target.closest('li').dataset;
    const product = products.find((p) => p.id === id);
    if (!confirm(`Delete "${product.name}"?`)) return;
    products = products.filter((p) => p.id !== id);
    persist();
    render();
  });

  render();
}
