// DSH home resolution shared by the package's Host half.
//
// Mirrors @deepseek-ai/dsh-home-paths (the same logic the dsh agent-presets
// roster uses to build its user root): the DSH_HOME environment override wins,
// then the platform home fallback. A relative DSH_HOME resolves against the
// process CWD (absolute), matching the shared contract.

'use strict'

const { homedir } = require('node:os')
const { isAbsolute, join } = require('node:path')

/** Expand a leading ~ (or ~user) in a path, platform-style. */
function expandHome(path, home = homedir()) {
  if (path === '~') return home
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(home, path.slice(2))
  return path
}

/**
 * Resolve the DSH home directory.
 * @param env - process environment to read DSH_HOME from.
 * @param home - platform home directory fallback (test seam).
 * @returns the absolute DSH home path.
 */
function resolveDshHome(env = process.env, home = homedir()) {
  const raw = env.DSH_HOME
  if (raw !== undefined && raw.trim() !== '') {
    const expanded = expandHome(raw.trim(), home)
    return isAbsolute(expanded) ? expanded : join(process.cwd(), expanded)
  }
  return join(home, '.dsh')
}

/** Resolve the DSH home directory from the live environment. */
function dshHome() {
  return resolveDshHome()
}

module.exports = { dshHome, expandHome, resolveDshHome }
