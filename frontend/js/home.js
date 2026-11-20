function setupCarousel() {
  const root = document.getElementById('banner');
  if (!root) return;
  const slides = [...root.querySelectorAll('.banner-slide')];
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

  root.querySelector('[data-dir="next"]').addEventListener('click', () => {
    show(index + 1);
    restart();
  });
  root.querySelector('[data-dir="prev"]').addEventListener('click', () => {
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

async function loadHome() {
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
