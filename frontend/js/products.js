async function loadProducts() {
  const current = queryParam('category') || '';
  const chips = document.getElementById('chips');
  const grid = document.getElementById('product-grid');
  try {
    const [categories, products] = await Promise.all([
      api('/categories'),
      api(current ? `/products?category=${encodeURIComponent(current)}` : '/products')
    ]);
    const all = `<a class="chip${current ? '' : ' is-active'}" href="/products.html">全部</a>`;
    chips.innerHTML = all + categories.map((category) => `
      <a class="chip${current === category.slug ? ' is-active' : ''}" href="/products.html?category=${encodeURIComponent(category.slug)}">${esc(category.name)}</a>
    `).join('');
    const category = categories.find((item) => item.slug === current);
    document.getElementById('page-title').textContent = category ? category.name : '全部商品';
    document.getElementById('page-note').textContent = category ? category.description : '五款示範商品，價格與庫存都來自資料庫。';
    grid.innerHTML = products.map(productCard).join('') || '<p>這個分類目前沒有商品。</p>';
  } catch (error) {
    grid.innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
  }
}

loadProducts();
