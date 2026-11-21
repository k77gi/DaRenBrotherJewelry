function setupCarousel() {
  const root = document.getElementById('banner');
  if (!root) return;
  const slides = [...root.querySelectorAll('.banner-slide')];
  const nextButton = root.querySelector('[data-dir="next"]');
  const prevButton = root.querySelector('[data-dir="prev"]');
  if (!slides.length || !nextButton || !prevButton) return;
  const dots = [...root.querySelectorAll('.banner-dot')];
  let index = 0;
  let timer = 0;

  function show(next) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, item) => slide.classList.toggle('is-active', item === index));
    dots.forEach((dot, item) => {
      dot.classList.toggle('is-active', item === index);
      if (item === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  function restart() {
    window.clearInterval(timer);
    timer = window.setInterval(() => show(index + 1), 5000);
  }

  nextButton.addEventListener('click', () => {
    show(index + 1);
    restart();
  });
  prevButton.addEventListener('click', () => {
    show(index - 1);
    restart();
  });
  dots.forEach((dot, item) => {
    dot.addEventListener('click', () => {
      show(item);
      restart();
    });
  });
  show(0);
  restart();
}

function paintBanners(banners) {
  const root = document.getElementById('banner');
  const slides = banners.map((banner, index) => `
    <article class="banner-slide ${index === 0 ? 'is-active' : ''}">
      <div>
        ${banner.eyebrow ? `<p class="eyebrow">${esc(banner.eyebrow)}</p>` : ''}
        <h1>${esc(banner.title)}</h1>
        ${banner.body ? `<p>${esc(banner.body)}</p>` : ''}
        <a class="btn" href="${esc(banner.linkHref)}">${esc(banner.linkLabel)}</a>
      </div>
      ${banner.image ? `<img src="${esc(banner.image)}" alt="${esc(banner.altText || banner.title)}" style="--banner-w:${Number(banner.imageWidth) || 480}px;--banner-h:${Number(banner.imageHeight) || 240}px">` : ''}
    </article>
  `).join('');
  const dots = banners.map((banner, index) => `
    <button class="banner-dot ${index === 0 ? 'is-active' : ''}" type="button" aria-label="第 ${index + 1} 張"></button>
  `).join('');
  root.innerHTML = `
    ${slides}
    <button class="banner-arrow prev" type="button" data-dir="prev" aria-label="上一張">‹</button>
    <button class="banner-arrow next" type="button" data-dir="next" aria-label="下一張">›</button>
    <div class="banner-controls">${dots}</div>
  `;
}

async function loadHome() {
  try {
    const banners = await api('/banners');
    if (banners.length) paintBanners(banners);
  } catch (error) {
    document.getElementById('banner').innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
  }
  setupCarousel();
  const grid = document.getElementById('product-grid');
  try {
    const products = await api('/products');
    const available = products.filter((product) => product.stock > 0);
    grid.innerHTML = available.map(productCard).join('') || '<p>目前沒有現貨。</p>';
  } catch (error) {
    grid.innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
  }
}

loadHome();
