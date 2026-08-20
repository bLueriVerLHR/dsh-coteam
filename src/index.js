// dsh-coteam — distributed collaboration team agent presets plugin.
//
// Host half only: on startup it syncs the bundled `presets/` tree into the
// harness-home agent-presets root (`~/.dsh/.agent-presets`), making the
// team-leader (小组长模式) and team-member (小组成员模式) presets selectable
// for new sessions without copying files by hand, and optionally announces
// the capability through a system-prompt section. No browser half, no routes,
// no agent tools — the presets themselves provide the tools.

'use strict'

const path = require('node:path')
const { dshHome } = require('./dsh-home.js')
const { syncPresetTrees } = require('./sync.js')

/** Stable cordis plugin name. */
const name = 'coteam'

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 150

/** Model-facing announcement: plugin presence and what it ships. */
const GUIDANCE = '本机已安装 dsh-coteam 插件（分布式协作团队 agent preset 集合）：新建会话的预设选择器中可选「小组长模式」与「小组成员模式」。小组长模式由 team-leader 预设提供，负责协调分派（组长本人被深度守卫禁止直接改文件，只能通过子 agent 委派）；小组成员模式由 team-member 预设提供，拥有完整工作能力。预设文件由插件维护于 ~/.dsh/.agent-presets，升级插件时自动更新；默认预设由用户自行选择。用户提到「小组长模式 / 小组成员模式 / coteam」时即指本插件，请据此协作。'

/** Absolute path of the bundled preset tree inside this package. */
function bundledPresetsRoot() {
  return path.join(__dirname, '..', 'presets')
}

/**
 * Mount the plugin: sync bundled presets into the harness-home agent-presets
 * root, then optionally announce through a system-prompt section.
 * @param ctx - host plugin context.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
function apply(ctx, config = {}) {
  const announceToAgent = config.announceToAgent !== false
  const retire = Array.isArray(config.retire) ? config.retire : []

  const sync = () => {
    const targetRoot = path.join(dshHome(), '.agent-presets')
    try {
      const result = syncPresetTrees(bundledPresetsRoot(), targetRoot, retire)
      for (const { id, error } of result.failed) {
        ctx.logger?.warn?.(`dsh-coteam: preset ${id} sync failed: ${error}`)
      }
      if (result.synced.length > 0) {
        ctx.logger?.info?.(`dsh-coteam: presets synced into ${targetRoot}: ${result.synced.join(', ')}`)
      }
      if (result.retired.length > 0) {
        ctx.logger?.info?.(`dsh-coteam: retired stale presets from ${targetRoot}: ${result.retired.join(', ')}`)
      }
    } catch (error) {
      ctx.logger?.warn?.(`dsh-coteam: preset sync failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  sync()

  // Optional announce: best-effort, never a hard dependency. If systemPrompt
  // is unavailable at apply time, the presets still sync; we just skip the
  // prompt section. The disposer is owned by ctx.effect so stop/update removes
  // it.
  let disposeSection
  const systemPrompt = ctx.get('systemPrompt')
  if (announceToAgent && systemPrompt !== undefined && typeof systemPrompt.section === 'function') {
    disposeSection = systemPrompt.section({ name: 'plugin:dsh-coteam', order: SECTION_ORDER, text: GUIDANCE })
  }

  ctx.effect(() => () => {
    if (disposeSection !== undefined) disposeSection()
    disposeSection = undefined
  }, 'dsh-coteam: announcement')
}

module.exports = { name, apply, bundledPresetsRoot, GUIDANCE, SECTION_ORDER }
