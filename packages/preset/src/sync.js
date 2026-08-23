// Sync every preset directory under `sourceRoot` into `targetRoot` — the dsh
// agent-presets discovery root (harness-home `.agent-presets`).
//
// A preset is a directory holding `agent.cordis.yml`; the directory name is
// the preset id. Copy is per-directory and idempotent: a preset whose target
// tree is byte-identical to the source tree is skipped, otherwise the source
// tree is copied and any target files the source does not contain are removed.
// Directories the plugin does not own (other presets the user authored) are
// never touched.
//
// After a preset is synced its `agent.cordis.yml` is validated against the
// structural preset schema; a validation failure is reported through the
// run's `failed` entries so callers can surface a broken preset rather than
// silently shipping it.

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { validateAgentCordis } = require('./schema.js')

/**
 * Clock/coarse-grain tolerance for the mtime fast path. When a source and a
 * target file share a size and a near-identical mtime we still fall through to
 * a byte comparison; a mtime gap beyond this simply proves the pair cannot be
 * byte-identical, so we skip the read.
 */
const MTIME_TOLERANCE_MS = 1000

function filesUnder(root) {
  const out = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry)
      if (fs.statSync(p).isDirectory()) walk(p)
      else out.push(p)
    }
  }
  walk(root)
  return out
}

/**
 * File identity is bytes. Size and mtime are only a fast negative check: a
 * size mismatch or a mtime gap beyond the tolerance proves the pair cannot be
 * byte-identical without reading both, but an equal size and close mtime still
 * fall through to a byte comparison so content differences are never missed.
 */
function sameFile(a, b) {
  const sourceStat = fs.statSync(a)
  const targetStat = fs.statSync(b)
  if (sourceStat.size !== targetStat.size) return false
  if (Math.abs(sourceStat.mtimeMs - targetStat.mtimeMs) > MTIME_TOLERANCE_MS) return false
  return fs.readFileSync(a).equals(fs.readFileSync(b))
}

/**
 * Remove files not in `keep` (relative paths), then remove only the
 * directories those removals left empty — still strictly inside `root`, so
 * sibling presets are never touched.
 */
function pruneExtras(root, keep) {
  const parents = new Set()
  for (const file of filesUnder(root)) {
    if (!keep.has(path.relative(root, file))) {
      parents.add(path.dirname(file))
      fs.rmSync(file, { force: true })
    }
  }
  for (const start of parents) {
    let dir = start
    while (dir !== undefined && path.relative(root, dir) !== '') {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmSync(dir, { recursive: true, force: true })
        dir = path.dirname(dir)
      } else {
        dir = undefined
      }
    }
  }
}

/** Validate the synced preset's `agent.cordis.yml` artifact on disk. */
function validatePresetAgentFile(presetDir) {
  const agent = path.join(presetDir, 'agent.cordis.yml')
  if (!fs.existsSync(agent)) return ['agent.cordis.yml is missing from the preset tree']
  return validateAgentCordis(fs.readFileSync(agent, 'utf8'))
}

/** Copy `sourceRoot/<id>` into `targetRoot/<id>`, idempotently. */
function syncOnePreset(sourceDir, targetDir) {
  const sourceFiles = filesUnder(sourceDir)
  const sourceSet = new Set(sourceFiles.map((file) => path.relative(sourceDir, file)))

  if (fs.existsSync(targetDir) && !fs.statSync(targetDir).isDirectory()) {
    fs.rmSync(targetDir, { recursive: true, force: true })
  }
  if (!fs.existsSync(targetDir)) {
    fs.cpSync(sourceDir, targetDir, { recursive: true, preserveTimestamps: true })
    pruneExtras(targetDir, sourceSet)
    return 'synced'
  }

  let dirty = false
  for (const file of sourceFiles) {
    const dest = path.join(targetDir, path.relative(sourceDir, file))
    if (!fs.existsSync(dest) || !sameFile(file, dest)) {
      dirty = true
      break
    }
  }
  if (!dirty) {
    for (const file of filesUnder(targetDir)) {
      if (!sourceSet.has(path.relative(targetDir, file))) {
        dirty = true
        break
      }
    }
  }
  if (!dirty) return 'current'

  // Drop target-only entries first so file/dir type clashes never reach
  // cpSync, then copy and prune again per the post-copy contract.
  pruneExtras(targetDir, sourceSet)
  fs.cpSync(sourceDir, targetDir, { recursive: true, preserveTimestamps: true })
  pruneExtras(targetDir, sourceSet)
  return 'synced'
}

/**
 * Sync every preset under `sourceRoot` into `targetRoot`, then remove
 * target directories named in `retire` that the bundle no longer ships —
 * preset ids the plugin once owned and later dropped. Only those exact ids
 * are removed; every other target directory is left untouched.
 *
 * Each synced (or already-current) preset is validated against the structural
 * `agent.cordis.yml` schema; a validation failure lands in `failed`.
 */
function syncPresetTrees(sourceRoot, targetRoot, retire = []) {
  const result = { synced: [], current: [], failed: [], retired: [] }
  fs.mkdirSync(targetRoot, { recursive: true })
  if (fs.existsSync(sourceRoot)) {
    for (const entry of fs.readdirSync(sourceRoot)) {
      const source = path.join(sourceRoot, entry)
      if (!fs.statSync(source).isDirectory()) continue
      const id = path.basename(source)
      const targetDir = path.join(targetRoot, id)
      let outcome
      try {
        outcome = syncOnePreset(source, targetDir)
      } catch (error) {
        result.failed.push({ id, error: error instanceof Error ? error.message : String(error) })
        continue
      }
      try {
        const problems = validatePresetAgentFile(targetDir)
        if (problems.length > 0) {
          result.failed.push({ id, error: `agent.cordis.yml failed validation: ${problems.join('; ')}` })
        } else if (outcome === 'synced') {
          result.synced.push(id)
        } else {
          result.current.push(id)
        }
      } catch (error) {
        result.failed.push({ id, error: error instanceof Error ? error.message : String(error) })
      }
    }
  }
  for (const id of retire) {
    if (fs.existsSync(path.join(sourceRoot, id))) continue
    const stale = path.join(targetRoot, id)
    if (fs.existsSync(stale) && fs.statSync(stale).isDirectory()) {
      fs.rmSync(stale, { recursive: true, force: true })
      result.retired.push(id)
    }
  }
  return result
}

module.exports = { syncOnePreset, syncPresetTrees, filesUnder, sameFile, pruneExtras }
