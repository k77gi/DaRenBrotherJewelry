const VISUALS = {
  'pearl-necklace': {
    colors: '柔白|淺粉',
    care: '用乾軟布擦去汗水與油脂即可。鏈身是鍍金銀鏈，請避免長時間碰水、游泳池與香水。收納時不要跟其他鍊子纏在一起。'
  },
  'gold-diamond-ring': {
    colors: '黃金色',
    care: '14K 金可用中性清潔劑輕刷後擦乾。洗手、做家事與運動時先取下。不要用牙膏磨，以免留下細痕。'
  },
  'jade-bracelet': {
    colors: '淡青',
    care: '玉石怕碰撞，請分開收納。彈力繩沾到乳液或汗水後用乾布擦乾，變鬆就不要再硬戴。避免長時間暴曬。'
  },
  'two-tone-studs': {
    colors: '黃白雙色',
    care: '耳釘可在卸下後用乾布擦過。剛打耳洞、尚在恢復期的人不建議佩戴。對金屬過敏時請先確認能配戴 14K 金。'
  },
  'agate-bracelet': {
    colors: '赭紅',
    care: '瑪瑙硬度高，仍要避免摔到硬地。流汗後用乾布擦過再收進布袋，不要與香水、保養品一起存放。'
  }
};

function imageSet(slug) {
  if (!VISUALS[slug]) {
    return [{ src: '/images/products/generic.svg', label: '商品圖' }];
  }
  return [
    { src: `/images/products/${slug}-1.svg`, label: '正面' },
    { src: `/images/products/${slug}-2.svg`, label: '細節' },
    { src: `/images/products/${slug}-3.svg`, label: '側面' }
  ];
}

async function backfillVisuals(db) {
  const update = db.prepare('UPDATE products SET colors = ?, care = ? WHERE id = ?');
  const rows = await db.prepare("SELECT id, slug, colors FROM products").all();
  for (const row of rows) {
    const visual = VISUALS[row.slug];
    if (!visual || row.colors) continue;
    await update.run(visual.colors, visual.care, row.id);
  }
}

module.exports = { VISUALS, imageSet, backfillVisuals };
