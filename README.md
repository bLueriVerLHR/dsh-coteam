# dsh-coteam —— 分布式协作团队预设集合（bundle 插件形态）

为 DeepSeek Harness 提供两个协作模式的 **agent preset**，以 **Cordis bundle 插件**
分发：插件 host 半身在 `dsh web` 启动时自动把预设同步进 dsh 的用户预设根
（`${DSH_HOME:-~/.dsh}/.agent-presets`），GUI 新建会话的预设选择器与设置里的
「Agent 预设」分区就能选中/管理这两个模式。

- **小组长模式（team-leader）**：团队主 agent，负责协调与分派。
- **小组成员模式（team-member）**：完成分派任务的成员，全功能、不加约束。

---

## 包含的模式

| 模式 | 预设 id | 目录 | 角色 |
| --- | --- | --- | --- |
| **小组长模式** | `team-leader` | `presets/team-leader/` | 团队主 agent：协调分派、管总 TODO、**不能直接改文件** |
| **小组成员模式** | `team-member` | `presets/team-member/` | 成员：完成分派任务，全功能、不加约束 |

模式的具体说明（人设、硬守卫、成员注入、视觉成员等）沿用 v0.2 的既定设计，见
`presets/team-leader/agent.cordis.yml` 与 `presets/team-member/agent.cordis.yml`
内的注释。

---

## 安装

### 方式一：Cordis bundle 插件（推荐）

```sh
# 发布版
dsh plugin --profile web add @blueriverlhr/dsh-coteam

# 本地开发
dsh plugin --profile web add link:<本仓库绝对路径>
```

装完**完整重启 `dsh web`**：插件 host 半身在启动时把 `presets/team-leader` 与
`presets/team-member` 同步进 `${DSH_HOME:-~/.dsh}/.agent-presets`，然后新建会话的
预设选择器即可选「小组长模式」和「小组成员模式」。

**升级**：改完预设（`presets/` 下）后发新版本号，`dsh plugin --profile web update
@blueriverlhr/dsh-coteam`（或重新 `add`），下次启动时插件自动刷新预设副本——
同步是内容感知的：只重写字节有变化的文件，绝不触碰用户自建的其他预设。

### 方式二：install.sh（零 npm 依赖的降级路径）

```sh
bash install.sh            # 安装（幂等）
bash install.sh uninstall  # 卸载（只删本包安装的两个目录）
bash install.sh -h         # 帮助
```

> `install.sh` 只是降级路径；装插件后无需再跑它。两条路径写进同一个用户预设根，
> 内容一致（都以 `presets/` 为源）。

---

## 为什么用 bundle 插件而不是只靠 install.sh

参考 `dsh-liangshen`（`packages/dsh-liangshen`）的成熟做法：rc.7 的 dsh 启动器
（`apps/cli` 的 `composeProfile`）会在所有 patch 层之后追加一个 overlay，把
`agent-presets.roots` 无条件覆写为 `[部署自带根]`——**bundle patch 因此无法注册新的
预设根**（`dsh --dump-config` 显示的 roots 是 overlay 之前的树，会骗人）。

但 `dsh-agent-presets` 的 `includeUserRoot`（默认 true）始终把
`${DSH_HOME:-~/.dsh}/.agent-presets`（`trust: "user"`）追加进扫描列表。所以 bundle
插件的正确姿势是：**不去注册新根，而是往这个始终被扫描的用户根里写预设目录**。
本包正是这么做的：

- `cordis.patch.yml` 只往 web profile 插入一行插件（`@blueriverlhr/dsh-coteam`），
  不受 roots 覆写影响；
- `src/index.js` 在 host 启动时把包内 `presets/` 同步进用户根；
- 升级插件版本 → 下次启动自动刷新预设（内容感知，幂等）。

---

## 验证（dsh 可感知）

装完后，用临时动态插件 probe（见文末「经验记录」）确认运行时真正发现并挂载了这两
个预设：

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
# 插件形态
dsh plugin --profile web remove @blueriverlhr/dsh-coteam
rm -rf "${DSH_HOME:-$HOME/.dsh}/.agent-presets/team-leader" "${DSH_HOME:-$HOME/.dsh}/.agent-presets/team-member"

# 或 install.sh 形态
bash install.sh uninstall
```

刷新后设置页里两个模式消失。运行中的会话在进程退出前仍沿用已挂载的组合；冷恢复时
回退到部署默认预设。

---

## 自定义

- **换视觉模型**：编辑两个 `presets/*/agent.cordis.yml` 中 `tool-subagent-vision`
  的 `agentOptions`（provider / model / maxTokens）。
- **调成员人设**：`presets/team-member/agent.cordis.yml` 的 persona，以及
  `presets/team-leader/agent.cordis.yml` 中 `tool-subagent` /
  `tool-subagent-vision` 的 `persona`（两份保持一致即可）。
- **改守卫名单**：`presets/team-leader/leader-guard.js` 顶部的 `MUTATION_TOOLS`。
- **退役旧预设 id**：插件 `config.retire`（数组），把包不再提供的预设 id 从用户根
  移除（升级改名场景用）。

> 注意：`leader-guard.js` 是 CommonJS（`module.exports`），因此本包的 `package.json`
> 保持 `"type": "commonjs"`——**不能**加 `"type": "module"`（否则 `.js` 会被当 ESM
> 加载而失败）。这是 dsh-coteam 选择整包 CJS 的原因：`src/*.js` 与 `leader-guard.js`
> 都是 CJS，无构建步骤，`import()` 加载也能正常工作（loader 的 `unwrapExports` 兼容）。

---

## 目录结构

```
dsh-coteam/
├── package.json          # @blueriverlhr/dsh-coteam；dsh.bundle.patch 声明；CJS
├── cordis.patch.yml      # 插件行：- id: coteam / name: '@blueriverlhr/dsh-coteam'
├── src/                  # host 半身（CJS，无构建）
│   ├── index.js          # apply()：启动时同步预设 + 可选 system-prompt 公告
│   ├── sync.js           # 内容感知、幂等的预设同步（字节比对/清理/退役/校验）
│   ├── schema.js         # agent.cordis.yml 结构校验
│   ├── dsh-home.js       # DSH_HOME / ~/.dsh 解析（与 dsh 自身一致）
│   └── sync.test.js      # node --test 单测（9 个用例）
├── install.sh            # 降级安装/卸载脚本（零 npm 依赖）
├── presets/
│   ├── team-leader/      # 「小组长模式」预设
│   │   ├── agent.cordis.yml
│   │   ├── preset.yml
│   │   └── leader-guard.js   # 本地 CJS 插件：depth-aware 硬守卫
│   └── team-member/      # 「小组成员模式」预设
│       ├── agent.cordis.yml
│       └── preset.yml
├── README.md             # 本文档
└── LICENSE               # GPL-3.0
```

---

## 设计要点

- **一个组合，两种身份**：子 agent 通过 `composeFrom` 继承组长的预设组合（所以组长
  预设必须带全套工作工具）；组长自己的修改能力被 `leader-guard.js` 按 depth 挡掉，
  成员（depth ≥ 1）则放行。
- **硬约束而非建议**：守卫在工具体运行前拒绝调用，组长即使"想"改文件也做不到，
  且每次拒绝都返回原因。
- **不约束成员**：成员预设不加工具过滤，完整支持编码 / 翻译 / 多媒体 / 视觉 /
  设置；成员也可以再 spawn 自己的子 agent 协助。
- **同步即交付**：预设文件打包进 npm 包（`files: ["presets"]`），host 启动时内容
  感知同步进用户根——升级自动刷新、幂等、只动自己拥有的目录、同步后结构校验。
- **可选的公告段**：`config.announceToAgent`（默认开）经 `ctx.get('systemPrompt')`
  守卫注册一个 `plugin:dsh-coteam` prompt section，让 agent 知道 coteam 已装；
  systemPrompt 不可用时静默跳过，不影响同步。

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
正确姿势不是注册新根，而是往这个用户根同步预设目录**——本包与 dsh-liangshen 都
采用这条路。

### 3. 本次踩过的坑（复用提醒）

- **`"type": "module"` 会让 `.js` 插件按 ESM 加载**：本包的 `leader-guard.js` 是
  CJS（`module.exports`），所以 `package.json` 保持 `"type": "commonjs"`，且整个
  `src/` 都用 CJS 写。加了 `"type": "module"` 后 `import('./leader-guard.js')`
  拿不到 `default`，guard 失效且不报清晰错误。
- **CJS 也能被 `import()` 加载**：Cordis loader 的 `unwrapExports` 处理
  `exports.default ?? exports`，CJS 包的 `module.exports = { name, apply }` 直接可用；
  无需 ESM/构建步骤。
- **`agentOptions` 三字段全必填**：`dsh-tool-subagent` 的 `agentOptions` 一旦提供，
  `provider` / `model` / `maxTokens` 都必填（对象整体可缺省，但不能给一半）。
- **动态插件定义不跨进程**：README 早期记录的 `probe-1` 在重启后已不可复用，
  `cordis_run` 也找不到它；需要时按上面代码重建。
- **动态工具 schema**：`harness.defineTool` 的 `parameters` 若设
  `additionalProperties: false`，在 rc.7 的 Guard 校验下会报
  `parameters.additionalProperties must be true or omitted`——缺省即可。
- **单元测试**：`npm test`（`node --test src/*.test.js`）覆盖同步的幂等 / 重写 /
  退役 / 不动他人 / 清理 / 字节比对 / 校验失败等关键路径，改同步逻辑后务必跑一遍。
