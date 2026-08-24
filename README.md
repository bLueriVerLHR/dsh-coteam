# dsh-coteam —— 分布式协作团队 monorepo 元包

为 DeepSeek Harness 提供分布式协作相关的 agent 能力，以 **Cordis bundle 插件**分发。
本仓库是一个 **monorepo 元包（Facade）**：根目录本身无业务代码，只是把可独立
安装的 **preset 子包**聚合进一个 bundle 层——装元包 = 一次拿到全部功能，也可以按需只装它。

| 子包 | npm 名 | 内容 |
| --- | --- | --- |
| **preset** | `@blueriverlhr/dsh-coteam-preset` | 两个协作模式 agent preset：**小组长模式（team-leader）** + **小组成员模式（team-member）** |

---

## 目录结构

```
dsh-coteam/                        # 元包（Facade）：聚合 preset，无自身代码
├── package.json                   # @blueriverlhr/dsh-coteam；dependencies: file:./packages/*
├── cordis.patch.yml               # GENERATED：聚合 preset 子包的插件行（勿手改——npm run build 生成）
├── build.mjs                      # 根构建：遍历 packages/* 建 lib/ + 重生成全部 cordis.patch.yml
├── scripts/
│   ├── build-package.mjs          # 每包子包构建：src/*.js 原样拷到 lib/（CJS/ESM 保持原样，无编译器）
│   ├── patch-emitter.mjs          # 确定性 YAML 写出器（受限形状：insert 列表 + id/name/config 标量）
│   └── compose-patch.mjs          # patch 组合（Composition Root）：FEATURES 数组聚合各子包 cordis.patch.js
├── tests/
│   ├── composition.mjs            # 组合守卫：从源重渲染，断言 patch 字节级一致
│   └── run-all.mjs                # 跑全部测试（组合守卫 + 各子包测试）
├── packages/
│   ├── preset/                    # @blueriverlhr/dsh-coteam-preset
│   │   ├── package.json           # CJS；main: lib/index.js
│   │   ├── cordis.patch.js        # patch 源（module.exports = [...]）—— 唯一事实源
│   │   ├── src/                   # host 半身（CJS，无构建）：index / sync / schema / dsh-home
│   │   ├── presets/               # team-leader/ + team-member/ 预设
│   │   └── tests/                 # 子包单测（node --test）
├── README.md                      # 本文档
└── LICENSE                        # GPL-3.0
```

> `cordis.patch.yml`（根与每个子包内的）都是 **GENERATED**：由 `npm run build`
> 从各子包的 `cordis.patch.js`（单一事实源）聚合生成，不要手改。子包的
> `lib/` 也是构建产物（无编译器，src→lib 原样拷贝），随包提交，消费者无需构建。

---

## 包含的模式（preset 子包）

| 模式 | 预设 id | 目录 | 角色 |
| --- | --- | --- | --- |
| **小组长模式** | `team-leader` | `packages/preset/presets/team-leader/` | 团队主 agent：协调分派、管总 TODO、**不能直接改文件** |
| **小组成员模式** | `team-member` | `packages/preset/presets/team-member/` | 成员：完成分派任务，全功能、不加约束 |

模式的具体说明（人设、硬守卫、成员注入等）见
`packages/preset/presets/team-leader/agent.cordis.yml` 与
`packages/preset/presets/team-member/agent.cordis.yml` 内的注释。

---

## 安装

> 分发方式：本仓库以 **GitHub 源码 + `file:` 本地安装** 分发（不发布 npm；两个
> package 均标记 `private: true`）。安装用 `file:` 指向本仓库绝对路径——pnpm 会拷贝
> 包并正确解析根包的 `file:./packages/*` 子包依赖（已实测端到端可用）。
>
> ⚠️ 请**不要**用 `link:` 或发布 npm：`link:` 只符号链接根包，子包依赖不会物化，
> 插件行无法解析、不会挂载；发布到 npm 时 `file:` 依赖同样会让消费者安装失败。

### 方式一：整包装元包（推荐）

```sh
dsh plugin --profile web add file:/本仓库绝对路径
# 例如
dsh plugin --profile web add file:/home/me/dsh-coteam
```

装完**完整重启 `dsh web`**：preset 子包 host 半身在启动时把
`presets/team-leader` 与 `presets/team-member` 同步进
`${DSH_HOME:-~/.dsh}/.agent-presets`，然后新建会话的预设选择器即可选「小组长模式」
和「小组成员模式」。

### 方式二：按需只装一个子包

```sh
# 只要协作预设
dsh plugin --profile web add file:/本仓库绝对路径/packages/preset
```

**升级**：改完内容（`presets/` 下）后重新 `add`（或
`dsh plugin --profile web remove` 后重新 `add`），下次启动时插件自动刷新——预设同步
是内容感知的：只重写字节有变化的文件，绝不触碰用户自建的其他预设。

---

## preset 子包：预设同步进用户根的机制

preset 子包的 host 半身（`packages/preset/src/`，CJS）在 `dsh web` 启动时把包内
`presets/` 树同步进 dsh 的用户预设根（`${DSH_HOME:-~/.dsh}/.agent-presets`），GUI 新建
会话的预设选择器与设置里的「Agent 预设」分区就能选中/管理这两个模式。

- `cordis.patch.js` 只往 web profile 插入一行插件（`@blueriverlhr/dsh-coteam-preset`），
  不受 `agent-presets.roots` 覆写影响（见「为什么用 bundle 插件」）；
- `src/index.js` 在 host 启动时把包内 `presets/` 同步进用户根；
- 升级插件版本 → 下次启动自动刷新预设（内容感知，幂等）。

---

## 为什么用 bundle 插件

rc.7 的 dsh 启动器（`apps/cli` 的 `composeProfile`）会在所有 patch 层之后追加一个
overlay，把 `agent-presets.roots` 无条件覆写为 `[部署自带根]`——**bundle patch 因此
无法注册新的预设根**（`dsh --dump-config` 显示的 roots 是 overlay 之前的树，会骗人）。

但 `dsh-agent-presets` 的 `includeUserRoot`（默认 true）始终把
`${DSH_HOME:-~/.dsh}/.agent-presets`（`trust: "user"`）追加进扫描列表。所以 bundle
插件的正确姿势是：**不去注册新根，而是往这个始终被扫描的用户根里写预设目录**。
本仓库正是这么做的——见上面 preset 子包说明。

---

## 验证（dsh 可感知）

装完后，用临时动态插件 probe（见文末「经验记录」）确认运行时真正发现并挂载了这两个
预设：

```
discovered presets: 6
  - standard [system] @ .../config/agent-presets/standard/agent.cordis.yml
  ...
  - team-leader [user] @ ${DSH_HOME:-~/.dsh}/.agent-presets/team-leader/agent.cordis.yml name=小组长模式
  - team-member [user] @ ${DSH_HOME:-~/.dsh}/.agent-presets/team-member/agent.cordis.yml name=小组成员模式
team-leader: MOUNTED OK
team-member: MOUNTED OK
```

GUI 侧：刷新设置页 → 「Agent 预设」分区出现两张 user 卡片（可设默认 / 复制 / 删除）；
新建会话的预设选择器出现两个模式。设置页在 `connection/reset`、`settings/changed`
以及自身操作时重读名单，因此**新增/改名预设后请刷新一次页面**。

---

## 卸载

```sh
dsh plugin --profile web remove @blueriverlhr/dsh-coteam
rm -rf "${DSH_HOME:-$HOME/.dsh}/.agent-presets/team-leader" "${DSH_HOME:-$HOME/.dsh}/.agent-presets/team-member"
```

刷新后设置页里两个模式消失。运行中的会话在进程退出前仍沿用已挂载的组合；冷恢复时
回退到部署默认预设。

---

## 自定义

- **视觉任务**：本包**不硬编码视觉模型**——没有专职视觉成员工具。需要读图/视觉任务时，
  组长会先向用户确认当前模型是否支持图片输入（见 `team-leader/agent.cordis.yml` 人设
  第 5 条），再决定如何分派；视觉能力由当前默认路由决定。
- **调成员人设**：`packages/preset/presets/team-member/agent.cordis.yml` 的 persona，
  以及 `packages/preset/presets/team-leader/agent.cordis.yml` 中 `tool-subagent` 的
  `persona`（两份保持一致即可）。
- **改守卫名单**：`packages/preset/presets/team-leader/leader-guard.js` 顶部的
  `MUTATION_TOOLS`。
- **退役旧预设 id**：preset 子包 `config.retire`（数组），把包不再提供的预设 id 从用户
  根移除（升级改名场景用）。

> 注意：`leader-guard.js` 是 CommonJS（`module.exports`），因此 preset 子包的
> `package.json` 保持 `"type": "commonjs"`——**不能**加 `"type": "module"`（否则
> `.js` 会被当 ESM 加载而失败）。这是 preset 子包整体选 CJS 的原因：`src/*.js` 与
> `leader-guard.js` 都是 CJS，无构建步骤，`import()` 加载也能正常工作（loader 的
> `unwrapExports` 兼容）。元包根 `"type": "module"` 只影响 `build.mjs`/`scripts/`/
> `tests/`（全是 ESM 工具脚本），与子包互不相干。

---

## 开发（monorepo 构建与测试）

```sh
npm run build   # ① 遍历 packages/* 构建各子包 lib/（src→lib 原样拷贝，跳过 *.test.js）
                # ② compose-patch.mjs 聚合各子包 cordis.patch.js → 生成各子包与根的 cordis.patch.yml
npm test        # build + 全部测试：组合守卫（tests/composition.mjs）+ 各子包测试（tests/run-all.mjs）
```

- **组合守卫**：从各 `cordis.patch.js` 源重渲染，断言提交的 `cordis.patch.yml`（根与各
  子包）**字节级一致**——手改生成的 patch 文件（或改了源没重跑 build）会直接红。
- **子包各自也可单独构建/测试**：`cd packages/preset && npm run build && npm test`
  （build 脚本复用元包的 `scripts/build-package.mjs`）。
- **patch 聚合顺序**：`FEATURES = ['preset']`（`scripts/compose-patch.mjs`），
  元包 patch 的行序即此顺序。
- **CommonJS 兼容**：preset 子包的 `cordis.patch.js` 是 `module.exports = [...]`；
  `compose-patch.mjs` 用 `import()` 动态加载，CJS 的 `module.exports` 会成为 namespace
  的 `default`，`module.default ?? module` 同时兼容 CJS 与 ESM 源。

---

## 设计要点

- **一个组合，两种身份**：子 agent 通过 `composeFrom` 继承组长的预设组合（所以组长
  预设必须带全套工作工具）；组长自己的修改能力被 `leader-guard.js` 按 depth 挡掉，
  成员（depth ≥ 1）则放行。
- **硬约束而非建议**：守卫在工具体运行前拒绝调用，组长即使"想"改文件也做不到，
  且每次拒绝都返回原因。
- **不约束成员**：成员预设不加工具过滤，完整支持编码 / 翻译 / 多媒体 / 视觉 /
  设置；成员也可以再 spawn 自己的子 agent 协助。
- **同步即交付**：预设文件打包进 preset 子包（`files: ["presets"]`），host 启动时内容
  感知同步进用户根——升级自动刷新、幂等、只动自己拥有的目录、同步后结构校验。
- **可选的公告段**：preset 子包 `config.announceToAgent`（默认开）经
  `ctx.get('systemPrompt')` 守卫注册一个 `plugin:dsh-coteam` prompt section，让 agent
  知道 coteam 已装；systemPrompt 不可用时静默跳过，不影响同步。
- **单一真源、两处产物**：patch 数据只存在于各子包的 `cordis.patch.js`，`npm run
  build` 从它同时生成「子包独立 patch」与「元包聚合 patch」，绝不漂移。

---

## 经验记录：probe 探针 & 为什么 bundle patch 注册预设根行不通

> 这段记录安装与调试本包时用到的技巧与踩坑，供以后排查类似问题复用。

### 1. probe：临时动态插件列预设 + 校验挂载

运行中的 `dsh web` 是一个长驻进程，`dsh --dump-config` 只显示**组合树**，不显示
**agentPresets 运行时实际发现了什么**。要确认运行中的 GUI 是否真正加载了某个预设，
最直接的办法是一个临时的动态 Cordis 插件（host 半身），通过 `agentPresets` 服务
查询。

关键代码（host 半身，`cordis_define` 创建）：

```js
return {
  inject: ['agentPresets'],
  apply(ctx) {
    harness.registerTool(ctx, harness.defineTool({
      name: 'preset_probe',
      description: '列出当前预设并校验目标预设可挂载。',
      parameters: {
        type: 'object',
        properties: {
          mount: { type: 'string', description: '只挂载校验这一个 preset id（可选）' },
        },
      },
      output: {
        schema: { type: 'string' },
        render(_a, v) { return [{ type: 'text', text: String(v) }] },
      },
      async execute(args) {
        const lines = []
        lines.push('defaultId: ' + ctx.agentPresets.defaultId)
        lines.push('roots:')
        for (const root of ctx.agentPresets.roots) lines.push('  [' + root.trust + '] ' + root.path)
        const all = await ctx.agentPresets.list()
        for (const p of all) {
          lines.push('  - ' + p.id + ' [' + p.trust + '] @ ' + p.path
            + (p.broken ? ' BROKEN: ' + p.broken : '') + (p.name ? ' name=' + p.name : ''))
        }
        const targets = args.mount === undefined ? ['team-leader', 'team-member']
          : (args.mount === '' ? [] : [args.mount])
        for (const id of targets) {
          try {
            await ctx.agentPresets.standingKeyFor(id)
            lines.push(id + ': MOUNTED OK')
          } catch (e) {
            lines.push(id + ': MOUNT FAIL: ' + e.message)
          }
        }
        return lines.join('\n')
      },
    }))
  },
}
```

要点：
- `list()` **无记忆**，每次调用重读磁盘，所以编辑/复制预设后再探针就能看到文件层面
  的变化。
- `standingKeyFor(id)` 会做**真实挂载**：组装该 preset 的插件子树并逐行 apply，能
  暴露 YAML/包名/isolate 冲突/未激活行等组合错误，是比 `--dump-config` 更接近
  "真实会话会用到的样子"的校验。它要求预设已被发现（在某个 root 下），未注册进
  root 的预设报 `preset "x" not found`。

### 2. 核心教训：bundle patch 无法注册预设根，但可以同步进用户根

**现象**：`dsh plugin --profile web add link:...` 后，`dsh --profile web
--dump-config` 里 `agent-presets` 行明明带着我们的 `roots`，运行中的 GUI 设置页
却看不到这两个预设；probe 显示运行时 `roots` 只有部署自带根 + 用户根。

**根因**（rc.7，`apps/cli/src/profile-boot.ts` 的 `composeProfile`）：

```ts
if (rows.has('agent-presets')) {
  composedOverlays.push({
    id: 'agent-presets',
    config: {
      ...(rows.get('agent-presets')?.config ?? {}),
      roots: [{ path: SHIPPED_PRESET_ROOT, trust: 'system' }],
    },
  })
}
```

启动器在所有 patch 层（bundle → profile 层 → home 层 → `--patch`）**之后**追加这个
overlay：先展开已有的 `config`，再把 `roots` **整体覆写**成 `[部署自带根]`。于是
无论 bundle / home / `--patch` 哪一层给 `agent-presets.roots` 写什么，最终生效的
只有部署自带根（`includeUserRoot` 再追加 `${DSH_HOME:-~/.dsh}/.agent-presets`）。

**`--dump-config` 为什么骗人**：dump 走的是 `prepareProfile`（只组合 patch 层），
**不含**这个 launcher overlay，所以它显示的是 overlay 之前的树——正是这个差异让
"验证通过但运行时不生效"的坑藏了很久。要验证运行时真相，用 probe，别用 dump。

**结论**：rc.7 上注册预设根的**唯一**生效路径是
`${DSH_HOME:-~/.dsh}/.agent-presets/`（真实目录；`scanRoot` 用
`readdir(withFileTypes)` 只认 `isDirectory()`，符号链接会被跳过，所以不能
`ln -s`）。这也是设置页 `agentPreset.copy()` 作者写入的根。**因此 bundle 插件的
正确姿势不是注册新根，而是往这个用户根同步预设目录**——本仓库采用这条路。

### 3. 本次踩过的坑（复用提醒）

- **`"type": "module"` 会让 `.js` 插件按 ESM 加载**：preset 子包的 `leader-guard.js`
  是 CJS（`module.exports`），所以该子包 `package.json` 保持 `"type": "commonjs"`，
  且整个 `src/` 都用 CJS 写。加了 `"type": "module"` 后 `import('./leader-guard.js')`
  拿不到 `default`，guard 失效且不报清晰错误。
- **CJS 也能被 `import()` 加载**：Cordis loader 的 `unwrapExports` 处理
  `exports.default ?? exports`，CJS 包的 `module.exports = { name, apply }` 直接可用；
  无需 ESM/构建步骤。
- **patch 组合对 CJS 源的兼容**：`compose-patch.mjs` 用 `import()` 加载子包
  `cordis.patch.js`，CJS 的 `module.exports = [...]` 会成为 namespace 的 `default`，
  所以 `module.default ?? module` 对 CJS/ESM 都能取到数组。
- **`agentOptions` 三字段全必填**：`dsh-tool-subagent` 的 `agentOptions` 一旦提供，
  `provider` / `model` / `maxTokens` 都必填（对象整体可缺省，但不能给一半）。
- **动态插件定义不跨进程**：README 早期记录的 `probe-1` 在重启后已不可复用，
  `cordis_run` 也找不到它；需要时按上面代码重建。
- **动态工具 schema**：`harness.defineTool` 的 `parameters` 若设
  `additionalProperties: false`，在 rc.7 的 Guard 校验下会报
  `parameters.additionalProperties must be true or omitted`——缺省即可。
- **单元测试**：preset 子包 `npm test`（`node --test tests/*.test.js`）覆盖同步的幂等 /
  重写 / 退役 / 不动他人 / 清理 / 字节比对 / 校验失败等关键路径，改同步逻辑后务必跑
  一遍。
