function categoryLinks(categories, current) {
  const all = `<a class="${current ? '' : 'is-active'}" href="${siteUrl('/shop.html')}">全部商品</a>`;
  return all + categories.map((category) => `
    <a class="${current === category.slug ? 'is-active' : ''}" href="${siteUrl(`/shop.html?category=${encodeURIComponent(category.slug)}`)}">${esc(category.name)}</a>
  `).join('');
}

async function loadShop() {
  const current = queryParam('category') || '';
  const nav = document.getElementById('category-nav');
  const grid = document.getElementById('product-grid');
  try {
    const [categories, products] = await Promise.all([
      api('/categories'),
      api(current ? `/products?category=${encodeURIComponent(current)}` : '/products')
    ]);
    nav.innerHTML = categoryLinks(categories, current);
    const category = categories.find((item) => item.slug === current);
    document.getElementById('page-title').textContent = category ? category.name : '珠寶小舖';
    document.getElementById('page-note').textContent = category
      ? category.description
      : '左側可依分類篩選。點商品可看材質、顏色與細節照片。';
    grid.innerHTML = products.map(productCard).join('') || '<p>這個分類目前沒有商品。</p>';
  } catch (error) {
    grid.innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
  }
}

loadShop();
