async function loadBlog() {
  const list = document.getElementById('article-list');
  try {
    const articles = await api('/articles');
    list.innerHTML = articles.map(articleCard).join('') || '<p>目前沒有文章。</p>';
  } catch (error) {
    list.innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
  }
}

loadBlog();
