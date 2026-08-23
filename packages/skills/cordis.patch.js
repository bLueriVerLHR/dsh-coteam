// skills 子包的 patch 源 —— 唯一事实源。
// `npm run build` 用元包的 scripts/compose-patch.mjs 聚合本文件与 preset 子包的
// patch 源，生成本包独立 cordis.patch.yml 与根聚合 cordis.patch.yml。
module.exports = [
  {
    insert: [
      { id: 'coteam-skills', name: '@blueriverlhr/dsh-coteam-skills' },
    ],
  },
]
