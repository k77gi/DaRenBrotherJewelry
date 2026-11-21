const PERMISSIONS = [
  ['catalog.read', '檢視商品分類', '可查看商品與分類'],
  ['products.write', '管理商品', '可新增、修改與刪除商品'],
  ['categories.write', '管理分類', '可新增商品分類'],
  ['articles.read', '檢視文章', '可查看小白教室文章'],
  ['articles.write', '管理文章', '可新增、修改與刪除文章'],
  ['orders.read', '檢視訂單', '可查看訂單與明細'],
  ['orders.write', '更新訂單', '可變更訂單狀態與物流單號'],
  ['members.read', '檢視會員', '可查看會員名單'],
  ['inquiries.read', '檢視聯絡訊息', '可查看與我聯絡的表單'],
  ['inquiries.write', '編輯聯絡訊息', '可修改與我聯絡的表單內容'],
  ['admins.read', '檢視管理員', '可查看管理員與角色'],
  ['admins.write', '管理管理員', '可新增、停用或啟用管理員'],
  ['permissions.write', '設定權限', '可勾選各角色可使用的模組'],
  ['audit.read', '檢視操作日誌', '可查看後台操作紀錄']
];

const MODULES = [
  {
    code: 'products',
    name: '商品管理',
    permissions: ['catalog.read', 'products.write', 'categories.write']
  },
  {
    code: 'articles',
    name: '文章管理',
    permissions: ['articles.read', 'articles.write']
  },
  {
    code: 'orders',
    name: '訂單管理',
    permissions: ['orders.read', 'orders.write']
  },
  {
    code: 'members',
    name: '會員管理',
    permissions: ['members.read']
  },
  {
    code: 'inquiries',
    name: '聯絡訊息',
    permissions: ['inquiries.read', 'inquiries.write']
  },
  {
    code: 'admins',
    name: '管理員與權限',
    permissions: ['admins.read', 'admins.write', 'permissions.write']
  },
  {
    code: 'audit',
    name: '操作日誌',
    permissions: ['audit.read']
  }
];

const ROLES = [
  {
    code: 'super_admin',
    name: '最大管理者',
    description: '可編輯任何資料，並可新增管理員與勾選分配權限',
    level: 1,
    modules: ['*']
  },
  {
    code: 'product_manager',
    name: '主要管理者',
    description: '可管理商品、文章與訂單，不可更改權限設定',
    level: 2,
    modules: ['products', 'articles', 'orders', 'inquiries']
  },
  {
    code: 'content_editor',
    name: '助理管理者',
    description: '只可管理小白教室文章',
    level: 3,
    modules: ['articles']
  }
];

function codesFor(role) {
  const selected = role.modules.includes('*')
    ? MODULES.map((item) => item.code)
    : role.modules;
  const codes = new Set();
  for (const moduleCode of selected) {
    const found = MODULES.find((item) => item.code === moduleCode);
    if (!found) throw new Error(`未知模組：${moduleCode}`);
    found.permissions.forEach((code) => codes.add(code));
  }
  return [...codes];
}

function modulesFor(permissionCodes) {
  return MODULES
    .filter((item) => item.permissions.every((code) => permissionCodes.includes(code)))
    .map((item) => item.code);
}

module.exports = { PERMISSIONS, MODULES, ROLES, codesFor, modulesFor };
