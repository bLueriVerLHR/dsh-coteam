# @blueriverlhr/dsh-coteam-skills

dsh-coteam 的 **skills 子包**：独立承载 agent skills（SKILL.md 内容仓库），供 dsh web GUI
使用。内容优先（content-first）——本次只建立 skills 内容，不做预设接线。

## 这是什么

- 本包是 dsh-coteam monorepo 的一个独立子包，与其他子包（preset 子包、元包）解耦。
- 每个 skill 是一个目录：`skills/<skill-id>/SKILL.md`，目录名即 skill id，kebab-case，
  不支持递归。
- 通过 Cordis bundle 机制（`cordis.patch.js` / `cordis.patch.yml`）作为
  `@blueriverlhr/dsh-coteam-skills` 插件被加载。

## 当前包含

- **grill-me**（拷问我的计划）：以「拷问者 / 魔鬼代言人」身份，按「设计树 + 前沿
  frontier」逐轮尖锐挑战用户的计划、决策或想法，直到双方达成共识。

## 内容优先

本次只建立 skills 内容（`skills/` 目录），不包含任何运行时接线：host half
（`src/host.js` / `lib/index.js`）保持最小空实现，不注册服务、不挂工具、不写状态。
后续如需把 skills 注册进 skill registry，或在预设中引用它们，再扩展本包。

## 如何接线（后续）

要在 team-leader / team-member 预设的 `agent.cordis.yml` 的 `skill-filesystem` 行配置
`customSkillDirs` 指向本包 `skills/` 目录，参考 dsh-better-webui cordis preset 的写法：

```yaml
customSkillDirs:
  - !!js "process.getBuiltinModule('node:url').fileURLToPath(new URL('skills/', baseUrl))"
```

- 独立安装本包时，`baseUrl` 指向本包（`packages/skills/`）根目录，`skills/` 即其下的
  skill 内容目录。
- skill 目录命名须 kebab-case；`<root>/<name>/SKILL.md`，目录名即 skill id；不支持递归。

## 如何安装

### 随元包安装

本包是 monorepo 的一部分，由根元包聚合安装（根聚合 `cordis.patch.yml` 由
`scripts/compose-patch.mjs` 生成，聚合各子包的 patch 源）。

### 独立安装（bundle）

```bash
npm install
npm run build   # 用 scripts/build-package.mjs 生成 lib/index.js 与 cordis.patch.yml
```

之后即可作为独立 bundle 插件安装到 dsh web GUI。

## 开发

```bash
npm test        # node --test tests/*.test.js，验证 skills 内容完整性
```
