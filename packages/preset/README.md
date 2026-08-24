# @blueriverlhr/dsh-coteam-preset

dsh-coteam 的 **preset 子包**：承载「小组长模式」（team-leader）与「小组成员模式」（team-member）两个 agent 预设，以及把它们同步进 dsh 用户预设根的 host 半身逻辑。

## 这是什么

dsh-coteam 被重构为 monorepo（元包 + 子包）后，本包负责原先 `presets/` 与 `src/` 的全部内容：

- **presets/**：两个 agent preset（`agent.cordis.yml` + `preset.yml`，team-leader 还有 `leader-guard.js` 硬守卫）。
- **src/**：host 半身（CJS，无构建）：`index.js`（插件入口，启动时同步预设 + 可选 system-prompt 公告）、`sync.js`（内容感知、幂等的预设同步）、`schema.js`（`agent.cordis.yml` 结构校验）、`dsh-home.js`（`DSH_HOME` 解析）。

## 它怎么工作

本包是一个 Cordis bundle 插件的 host 半身（`dsh.bundle.patch` 声明了 patch）。当 dsh web 启动时，`src/index.js` 的 `apply()` 会把 `presets/` 里的两个预设**内容感知、幂等地**同步进 `${DSH_HOME:-~/.dsh}/.agent-presets`，使新会话的预设选择器里可直接选择「小组长模式 / 小组成员模式」。同步是幂等的：目标树与源树字节一致时跳过；目标里源不再包含的文件会被清理；用户自建的其它预设目录从不被触碰。可选的 system-prompt 公告（`announceToAgent`，默认开）会向模型声明本插件的存在与能力。

`src/index.js` 用 `__dirname/../presets` 定位内置预设树——在子包布局里（`src/` 与 `presets/` 平级于包根），路径依然成立，无需改动。

## 如何安装

- **独立（bundle）安装**：本包自身就是 bundle 插件。`npm run build` 会用元包的 `scripts/compose-patch.mjs` 把 `cordis.patch.js`（唯一事实源）聚合，生成 `cordis.patch.yml`；随后 `dsh plugin --profile web add file:<abs path>/packages/preset`（本地安装；分发不发布 npm，见根 README）。
- **随元包安装**：根元包 `@blueriverlhr/dsh-coteam` 通过 `file:./packages/preset` 依赖聚合本包，用户 `dsh plugin --profile web add file:<元包绝对路径>` 即安装本包。

## 目录结构

```
packages/preset/
├── package.json          # @blueriverlhr/dsh-coteam-preset；type: commonjs
├── cordis.patch.js       # patch 唯一事实源（CJS；build 生成 cordis.patch.yml）
├── src/                  # host 半身（CJS，无构建）
│   ├── index.js          # 插件入口：同步预设 + 可选公告
│   ├── sync.js           # 内容感知、幂等同步
│   ├── schema.js         # agent.cordis.yml 结构校验
│   └── dsh-home.js       # DSH_HOME 解析
├── presets/
│   ├── team-leader/      # 小组长模式（含 leader-guard.js）
│   └── team-member/      # 小组成员模式
└── tests/
    └── sync.test.js      # node --test 测试（相对 ../src 引用）
```

## CJS 约束（重要）

本包**必须保持 `"type": "commonjs"`**：

- `presets/team-leader/leader-guard.js` 是 CommonJS（`module.exports`），由 `agent.cordis.yml` 通过相对路径 `./leader-guard.js` 引用；一旦包声明 `"type": "module"`，该 `.js` 会被当 ESM 加载而失效。
- 因此 `src/*.js` 也统一用 CJS（`require` / `module.exports`）编写，无构建步骤；`cordis.patch.js` 同样用 `module.exports`，元包 `compose-patch.mjs` 用 `import()` 动态加载时，CJS 的 `module.exports` 会作为 default export 被正确读取。

## 测试

```bash
node --test packages/preset/tests/*.test.js   # 在仓库根运行（测试内为相对路径）
```
