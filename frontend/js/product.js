function openLightbox(src, alt) {
  let dialog = document.getElementById('lightbox');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'lightbox';
    dialog.className = 'lightbox';
    dialog.innerHTML = '<button class="btn secondary" type="button" id="lightbox-close">關閉</button><img alt="">';
    document.body.appendChild(dialog);
    dialog.querySelector('#lightbox-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }
  const image = dialog.querySelector('img');
  image.src = src;
  image.alt = alt;
  dialog.showModal();
}

async function loadProduct() {
  const root = document.getElementById('product');
  const id = queryParam('id');
  if (!id) {
    root.innerHTML = '<p class="alert error">找不到這個商品。</p>';
    return;
  }
  try {
    const [product, categories] = await Promise.all([
      api(`/products/${encodeURIComponent(id)}`),
      api('/categories')
    ]);
    document.title = `${product.name}｜大仁哥的珠寶小舖`;
    const images = product.images && product.images.length
      ? product.images
      : [{ src: '/images/products/generic.svg', label: '商品圖' }];
    const colors = product.colors || [];
    const materials = String(product.material || '').split('、').filter(Boolean);
    root.innerHTML = `
      <div class="detail-layout">
        <nav class="cat-nav" aria-label="產品分類">
          ${categories.map((category) => `
            <a class="${category.slug === product.categorySlug ? 'is-active' : ''}" href="/shop.html?category=${encodeURIComponent(category.slug)}">${esc(category.name)}</a>
          `).join('')}
        </nav>
        <div>
          <button class="main-photo" type="button" id="main-photo">
            <img id="main-image" src="${esc(images[0].src)}" alt="${esc(product.name)} ${esc(images[0].label)}">
          </button>
          <div class="thumbs" id="thumbs">
            ${images.map((image, index) => `
              <button type="button" class="${index === 0 ? 'is-active' : ''}" data-src="${esc(image.src)}" data-label="${esc(image.label)}">
                <img src="${esc(image.src)}" alt="${esc(image.label)}">
              </button>
            `).join('')}
          </div>
        </div>
        <div>
          <p class="eyebrow">${esc(product.categoryName)}</p>
          <h1>${esc(product.name)}</h1>
          <p class="price">${money(product.price)}</p>
          <p>${esc(product.summary)}</p>
          <p class="muted">${product.stock > 0 ? `庫存 ${product.stock} 件` : '暫時缺貨'}${product.weightGrams ? `，約 ${esc(product.weightGrams)} 公克` : ''}</p>
          <p>顏色</p>
          <div class="choice-row" id="colors">
            ${(colors.length ? colors : ['標準色']).map((color, index) => `
              <button class="option ${index === 0 ? 'is-active' : ''}" type="button" data-color="${esc(color)}">${esc(color)}</button>
            `).join('')}
          </div>
          <p>材質</p>
          <div class="choice-row">
            ${materials.map((item) => `<span class="option is-active">${esc(item)}</span>`).join('') || `<span class="option is-active">${esc(product.material)}</span>`}
          </div>
          ${(product.extraFields || []).length ? `
            <dl class="extra-fields">
              ${product.extraFields.map((field) => `
                <div><dt>${esc(field.label)}</dt><dd>${esc(field.value)}</dd></div>
              `).join('')}
            </dl>
          ` : ''}
          <p class="muted">大仁哥的珠寶小舖挑選日常好戴的入門飾品，材質與保養方式直接寫在商品頁。</p>
          <div class="inline">
            <div class="stepper">
              <button type="button" id="qty-dec" aria-label="減少數量">-</button>
              <input id="qty" value="1" inputmode="numeric" aria-label="數量" ${product.stock > 0 ? '' : 'disabled'}>
              <button type="button" id="qty-inc" aria-label="增加數量">+</button>
            </div>
            <button class="btn" id="add-cart" type="button" ${product.stock > 0 ? '' : 'disabled'}>加入購物車</button>
            <button class="btn secondary" id="buy-now" type="button" ${product.stock > 0 ? '' : 'disabled'}>立即購買</button>
          </div>
          <p id="added" class="alert ok" hidden></p>
        </div>
      </div>
      <h2>不同角度</h2>
      <div class="gallery-grid">
        ${images.map((image) => `
          <figure>
            <img src="${esc(image.src)}" alt="${esc(product.name)} ${esc(image.label)}">
            <figcaption>${esc(image.label)}</figcaption>
          </figure>
        `).join('')}
      </div>
      <h2>保養說明</h2>
      <div class="prose">${paragraphs(product.care || product.description)}</div>
      <h2>商品介紹</h2>
      <div class="prose">${paragraphs(product.description)}</div>
    `;

    let selected = colors[0] || '';
    const qtyInput = document.getElementById('qty');
    const max = Math.max(1, Math.min(99, product.stock));
    const setQty = (value) => {
      let next = Number(value);
      if (!Number.isInteger(next) || next < 1) next = 1;
      if (next > max) next = max;
      qtyInput.value = String(next);
    };
    document.getElementById('qty-dec').addEventListener('click', () => setQty(Number(qtyInput.value) - 1));
    document.getElementById('qty-inc').addEventListener('click', () => setQty(Number(qtyInput.value) + 1));
    qtyInput.addEventListener('change', () => setQty(qtyInput.value));
    document.getElementById('colors').addEventListener('click', (event) => {
      const button = event.target.closest('[data-color]');
      if (!button) return;
      selected = button.dataset.color === '標準色' ? '' : button.dataset.color;
      document.querySelectorAll('#colors .option').forEach((item) => item.classList.toggle('is-active', item === button));
    });
    const main = document.getElementById('main-image');
    document.getElementById('thumbs').addEventListener('click', (event) => {
      const button = event.target.closest('[data-src]');
      if (!button) return;
      main.src = button.dataset.src;
      main.alt = `${product.name} ${button.dataset.label}`;
      document.querySelectorAll('#thumbs button').forEach((item) => item.classList.toggle('is-active', item === button));
    });
    document.getElementById('main-photo').addEventListener('click', () => openLightbox(main.src, main.alt));

    function chosenQty() {
      const quantity = Number(qtyInput.value);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
        throw new Error('請輸入有效的數量');
      }
      return quantity;
    }
    function showMessage(text, ok) {
      const message = document.getElementById('added');
      message.hidden = false;
      message.className = ok ? 'alert ok' : 'alert error';
      message.textContent = text;
    }
    document.getElementById('add-cart').addEventListener('click', () => {
      try {
        addToCart(product.id, chosenQty(), selected);
        showMessage('已加入購物車。', true);
      } catch (error) {
        showMessage(error.message, false);
      }
    });
    document.getElementById('buy-now').addEventListener('click', () => {
      try {
        addToCart(product.id, chosenQty(), selected);
        location.href = '/checkout.html';
      } catch (error) {
        showMessage(error.message, false);
      }
    });
  } catch (error) {
    root.innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
  }
}

loadProduct();
