// skills 子包 host half —— 内容优先（content-first）。
//
// 本子包当前承载 agent skills 的 SKILL.md 内容仓库（见 skills/ 目录），不做任何
// 运行时接线：不注册服务、不挂工具、不写状态。host half 保留为最小空实现，保持
// bundle 可被 Cordis 加载；后续若要把 skills 注册进 skill registry 或让预设
// 通过 customSkillDirs 引用它们，再在此扩展。
'use strict'

exports.name = 'coteam-skills'

/** @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context. */
exports.apply = function apply() {
  // intentionally empty
}
