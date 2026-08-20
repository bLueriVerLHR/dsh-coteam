# coteam —— 分布式协作团队预设集合

为 DeepSeek Harness 提供两个协作模式的 **agent preset**，安装到 dsh 的**用户预设根**
（`${DSH_HOME:-~/.dsh}/.agent-presets`）后，GUI 新建会话的预设选择器与设置里的
「Agent 预设」分区就能选中/管理这两个模式。

- **小组长模式（team-leader）**：团队主 agent，负责协调与分派。
- **小组成员模式（team-member）**：完成分派任务的成员，全功能、不加约束。

---

## 包含的模式

| 模式 | 预设 id | 目录 | 角色 |
| --- | --- | --- | --- |
| **小组长模式** | `team-leader` | `team-leader/` | 团队主 agent：协调分派、管总 TODO、**不能直接改文件** |
| **小组成员模式** | `team-member` | `team-member/` | 成员：完成分派任务，全功能、不加约束 |

### 小组长模式（team-leader）

**人设与工作方式**
1. 把用户的大目标拆成清晰的 TODO 任务清单，用 `todo` 工具维护并跟踪进度。
2. 创建子 agent（`subagent` / `subagent_vision` / `subagent_fork`）并把任务委派下去；
   用 `send_message` / `interrupt_agent` / `list_agents` 协调成员。
3. 分布式协作编排：给每个成员分配独立的工作子目录（如 `work/member-01/` 等）和
   独立 git 分支，让成员各自提交。最终合并是**中心化任务**，但组长依然要**任命一个
   子 agent** 在主干上把各成员的分支 merge 回项目，组长自己不动手。
4. 任何情况下有疑问、困惑、二义性或多种实现方案，都必须与用户协商（
   `ask_user_question` 提供选项）；用户信息不足就继续提问，直到没有困惑为止。
5. **成员失联处理**：如果某成员没有返回消息就停止工作，先查原因（`list_agents`
   看状态 + `send_message` 询问进展/阻塞点），再定路线；理论上**优先尝试在原会话
   继续**（`send_message` 让它继续），只有确认原会话确实无法恢复时才新开子 agent
   会话重做，并向用户说明原因与选择。

**硬约束（由系统守卫强制，不是人设承诺）**
- `team-leader/leader-guard.js` 注册一个 depth-aware 的 `tools.guard`。
- 组长自己（委派深度 depth 0）调用 `bash` / `pwsh` / `write` / `edit` /
  `str_replace_editor` / `run_code` / `terminal_open` / `terminal_send` 会被系统
  直接拒绝，并返回中文原因。
- 被委派的成员（depth ≥ 1）不受影响，可以正常读写文件、执行命令。
- 组长仍可使用只读工具（`read` / `glob` / `grep` / `read_image`）了解项目状态、
  验证成员成果。

**成员人设注入**
- `subagent` / `subagent_vision` 工具实例的 `persona` 配置，把「小组成员」人设
  注入到每个 spawn 出的子 agent，覆盖其 deployment persona（同名段，最近作用域
  胜出）。子 agent 继承组长预设的全套工具（因为是通过 composeFrom 继承组合），
  所以成员拿到的是「成员身份 + 完整工作能力」。

**视觉成员**
- `subagent_vision` 使用与组长**不同**的、支持图片输入的模型（默认
  `opencode-go` / `kimi-k3`，pi-ai 目录声明 `input: [text, image]`），用于视觉
  编排 / 视觉阅读 / 多媒体任务。换模型只需改该工具实例的 `agentOptions`
  （provider / model / maxTokens）。

### 小组成员模式（team-member）

- **全功能、不加约束**：编码、Shell、文件读写（含 `read_image` 图片阅读）、网页
  检索、翻译、多媒体、系统设置、skills、plan mode、goal、todo 等全套工具。
- **人设**：在分配的子目录内工作、用 git 提交、完成后向组长报告（`report` 工具）。
- **强制规则**：任何超出能力范围或明确授权范围的任务，必须先征得组长或用户的同意
  才能继续；否则必须停止该操作并**失败，且给出清晰、具体的原因**（原因必须说明
  为什么无法/不应执行）。遇到歧义向组长报告并等待指示。
- 成员模型可自由选择：组长 spawn 时用 `agentOptions` 指定；手动开成员会话时在
  GUI 里选。

---

## 安装（install.sh）

```bash
bash /home/archie/forge/coteam/install.sh
```

脚本把 `team-leader/` 与 `team-member/` 两个**真实目录**复制到
`~/.dsh/.agent-presets/`。装完**无需重启** `dsh web`：`agentPresets.list()` 每次
调用都重读磁盘，刷新一次设置页面（或新建会话）即可看到「小组长模式」和
「小组成员模式」。

> 仓库目录是源，用户预设根里的两份是副本。改完 `agent.cordis.yml` 后再跑一次
> `install.sh` 即可覆盖生效（幂等：先删后拷）。

**为什么不是 dsh plugin bundle？** rc.7 的 dsh 启动器（`apps/cli` 的
`composeProfile`）会在所有 patch 层**之后**追加一个 overlay，把 `agent-presets`
行的 `roots` 无条件覆写为 `[部署自带根]`。因此 bundle patch 里写给
`agent-presets.roots` 的任何值都会在启动时被抹掉——bundle 层**无法**注册预设根。
`dsh --dump-config` 显示的是 overlay 之前的树，看起来"已生效"，实际运行时并没有。
详见文末「经验记录」。

---

## 验证（dsh 可感知）

装完后，用临时动态插件 probe（`preset_probe` 工具，见「经验记录」）确认运行时真正
发现并挂载了这两个预设：

```
discovered presets: 6
  - standard [system] @ .../config/agent-presets/standard/agent.cordis.yml
  ...
  - team-leader [user] @ /home/archie/.dsh/.agent-presets/team-leader/agent.cordis.yml name=小组长模式
  - team-member [user] @ /home/archie/.dsh/.agent-presets/team-member/agent.cordis.yml name=小组成员模式
team-leader: MOUNTED OK
team-member: MOUNTED OK
```

GUI 侧：刷新设置页 → 「Agent 预设」分区出现两张 user 卡片（可设默认 / 复制 / 删除）；
新建会话的预设选择器出现两个模式。设置页在 `connection/reset`、`settings/changed`
以及自身操作时重读名单，因此**新增/改名预设后请刷新一次页面**。

---

## 卸载

```bash
rm -rf ~/.dsh/.agent-presets/team-leader ~/.dsh/.agent-presets/team-member
```

刷新后设置页里两个模式消失。运行中的会话在进程退出前仍沿用已挂载的组合；冷恢复时
回退到部署默认预设。

---

## 自定义

- **换视觉模型**：编辑两个 `agent.cordis.yml` 中 `tool-subagent-vision` 的
  `agentOptions`（provider / model / maxTokens），改为你的视觉模型。
- **调成员人设**：`team-member/agent.cordis.yml` 的 persona，以及
  `team-leader/agent.cordis.yml` 中 `tool-subagent` / `tool-subagent-vision` 的
  `persona`（两份保持一致即可）。
- **改守卫名单**：`team-leader/leader-guard.js` 顶部的 `MUTATION_TOOLS`。

> 注意：`leader-guard.js` 是 CommonJS（`module.exports`），因此 coteam 的
> `package.json` **不能**加 `"type": "module"`（否则 `.js` 会被当 ESM 加载而失败）。

---

## 目录结构

```
coteam/
├── package.json               # 包元数据（非 bundle）
├── install.sh                 # 复制预设进 dsh 用户预设根（真实目录）
├── README.md                  # 本文档
├── team-leader/               # 「小组长模式」预设
│   ├── agent.cordis.yml       # 组合：全套工具 + 协调工具 + 成员人设注入
│   ├── preset.yml             # 显示名/描述
│   └── leader-guard.js        # 本地 CJS 插件：depth-aware 硬守卫
└── team-member/               # 「小组成员模式」预设
    ├── agent.cordis.yml       # 全功能工具 + 成员人设（不加约束）
    └── preset.yml             # 显示名/描述
```

---

## 设计要点

- **一个组合，两种身份**：子 agent 通过 `composeFrom` 继承组长的预设组合（所以组长
  预设必须带全套工作工具）；组长自己的修改能力被 `leader-guard.js` 按 depth 挡掉，
  成员（depth ≥ 1）则放行。
- **硬约束而非建议**：守卫在工具体运行前拒绝调用，组长即使"想"改文件也做不到，
  且每次拒绝都返回原因。
- **不约束成员**：按你的要求，成员预设不加工具过滤，完整支持编码 / 翻译 / 多媒体 /
  视觉 / 设置；成员也可以再 spawn 自己的子 agent 协助。

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
        const all = await ctx.agentPresets.list()        // 发现结果（每次重读磁盘）
        for (const p of all) {
          lines.push('  - ' + p.id + ' [' + p.trust + '] @ ' + p.path
            + (p.broken ? ' BROKEN: ' + p.broken : '') + (p.name ? ' name=' + p.name : ''))
        }
        const targets = args.mount === undefined ? ['team-leader', 'team-member']
          : (args.mount === '' ? [] : [args.mount])
        for (const id of targets) {
          try {
            await ctx.agentPresets.standingKeyFor(id)     // 真实挂载校验
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

用法：`cordis_define` 创建 → `cordis_run` 运行 → 下一次工具调用直接调用
`preset_probe` → 用完 `cordis_stop`（保留定义）。注意动态插件定义**不跨进程**：
重启 `dsh web` 后需重新创建。

要点：
- `list()` **无记忆**，每次调用重读磁盘，所以编辑/复制预设后再探针就能看到文件层面
  的变化。
- `standingKeyFor(id)` 会做**真实挂载**：组装该 preset 的插件子树并逐行 apply，能
  暴露 YAML/包名/isolate 冲突/未激活行等组合错误，是比 `--dump-config` 更接近
  "真实会话会用到的样子"的校验。它要求预设已被发现（在某个 root 下），未注册进
  root 的预设报 `preset "x" not found`。

### 2. 核心教训：bundle patch 无法注册预设根

**现象**：`dsh plugin --profile web add link:/...` 后，`dsh --profile web
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
overlay：先展开已有的 `config`，再把 `roots` **整体覆写**成 `[部署自带根]`。
于是无论 bundle / home / `--patch` 哪一层给 `agent-presets.roots` 写什么，最终生效
的只有部署自带根（`includeUserRoot` 再追加 `~/.dsh/.agent-presets`）。

**`--dump-config` 为什么骗人**：dump 走的是 `prepareProfile`（只组合 patch 层），
**不含**这个 launcher overlay，所以它显示的是 overlay 之前的树——正是这个差异让
"验证通过但运行时不生效"的坑藏了很久。要验证运行时真相，用 probe，别用 dump。

**结论**：rc.7 上注册预设根的**唯一**生效路径是 `~/.dsh/.agent-presets/`（真实
目录；`scanRoot` 用 `readdir(withFileTypes)` 只认 `isDirectory()`，符号链接会被
跳过，所以不能 `ln -s`）。这也是设置页 `agentPreset.copy()` 作者写入的根。

### 3. 本次踩过的坑（复用提醒）

- **`"type": "module"` 会让 `.js` 插件按 ESM 加载**：coteam 的 `leader-guard.js` 是
  CJS（`module.exports`），所以 coteam 的 `package.json` 不能加 `"type": "module"`。
  加了之后 `import('./leader-guard.js')` 拿不到 `default`，guard 失效且不报清晰错误。
- **`agentOptions` 三字段全必填**：`dsh-tool-subagent` 的 `agentOptions` 一旦提供，
  `provider` / `model` / `maxTokens` 都必填（对象整体可缺省，但不能给一半）。
- **动态插件定义不跨进程**：README 早期记录的 `probe-1` 在重启后已不可复用，
  `cordis_run` 也找不到它；需要时按上面代码重建。
- **动态工具 schema**：`harness.defineTool` 的 `parameters` 若设
  `additionalProperties: false`，在 rc.7 的 Guard 校验下会报
  `parameters.additionalProperties must be true or omitted`——缺省即可。
