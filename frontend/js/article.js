async function loadArticle() {
  const root = document.getElementById('article');
  const id = queryParam('id');
  if (!id) {
    root.innerHTML = '<p class="alert error">找不到這篇文章。</p>';
    return;
  }
  try {
    const article = await api(`/articles/${encodeURIComponent(id)}`);
    document.title = `${article.title}｜大仁哥的珠寶小舖`;
    const date = String(article.publishedAt || article.createdAt || '').slice(0, 10);
    root.innerHTML = `
      <p class="eyebrow">小白教室　${esc(date)}</p>
      <h1>${esc(article.title)}</h1>
      <img src="${esc(siteUrl(article.thumbnail))}" alt="" style="width:min(100%, 720px); display:block; margin:0 0 16px;">
      <p>${esc(article.summary)}</p>
      <div class="prose">${paragraphs(article.content)}</div>
      <p><a href="${siteUrl('/blog.html')}">回小白教室</a></p>
    `;
  } catch (error) {
    root.innerHTML = `<p class="alert error">${esc(readableError(error))}</p>`;
  }
}

loadArticle();
