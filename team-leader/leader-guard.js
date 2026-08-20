// 小组长模式 —— 硬约束守卫 (Team Leader hard guard)
//
// 这个模块是一个 Cordis 主机插件，由 team-leader/agent.cordis.yml 通过相对路径
// './leader-guard.js' 引用（该 preset 的 baseUrl 就是本目录）。
//
// 作用：
//   「小组长模式」预设被 standing mount 组装一次，组长（depth 0）和它委派的所有
//   子 agent（depth >= 1）通过作用域父子关系共享同一份组合，包括这一个守卫。
//   守卫按调用者（exec.agent）的委派深度区分：
//     - depth 0（组长本人）：拒绝一切会修改文件/系统的工具（bash/pwsh/write/
//       edit/str_replace_editor/run_code/terminal_*），并返回明确的中文原因。
//     - depth >= 1（被委派的成员）：放行，成员正常干活。
//   这使「主 agent 不能对文件做任何修改」成为真正的硬约束，而非人设承诺：
//   即使组长模型试图调用修改工具，调用也会在工具体运行前被守卫拒绝。

'use strict'

/** 会修改文件或系统状态的工具名集合。 */
const MUTATION_TOOLS = new Set([
  'bash',
  'pwsh',
  'run_code',
  'terminal_open',
  'terminal_send',
  'write',
  'edit',
  'str_replace_editor',
])

/** 计算调用 agent 的委派深度（与 delegationDepthOf 一致）。 */
function delegationDepth(agent) {
  if (agent === undefined) return 0
  const headerDepth = agent.session?.header?.delegationDepth ?? 0
  const optionDepth = agent.options?.subagentDepth ?? 0
  return Math.max(headerDepth, optionDepth)
}

/**
 * Cordis 插件：注册一个 depth-aware 的 tools.guard。
 *
 * 需要注入 tools（宿主工具注册表）；守卫通过 exec.agent 拿到调用者，据此放行
 * 成员、拒绝组长。守卫注册进 standing mount 的作用域层，所有加入该预设的 agent
 * 都通过作用域链解析到它。
 */
module.exports = {
  name: 'team-leader-guard',
  inject: ['tools'],
  apply(ctx) {
    ctx.tools.guard((exec) => {
      const depth = delegationDepth(exec.agent)
      if (depth > 0) return undefined // 被委派的成员：放行
      if (MUTATION_TOOLS.has(exec.name)) {
        return '小组长模式：主 agent 不得直接修改文件或系统状态（工具 "' + exec.name + '" 已被拒绝）。请创建子 agent 并委派该任务；或与用户协商后由成员执行。'
      }
      return undefined
    })
  },
}
