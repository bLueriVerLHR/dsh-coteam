/**
 * Patch composer — the Composition Root of the split.
 *
 * Each feature package owns its patch as plain JS data in `cordis.patch.js`
 * (the row that mounts its host plugin). The preset package is CommonJS
 * (`module.exports = [...]` — it must stay CJS because `leader-guard.js` is
 * `module.exports`). This module aggregates those sources and writes:
 *
 *   - `packages/<feature>/cordis.patch.yml` — the feature's own standalone
 *     bundle layer (so a feature is installable on its own), and
 *   - the root `cordis.patch.yml` — the meta bundle's aggregated layer that
 *     mounts every feature (so installing the meta installs all features).
 *
 * One source of truth, two artifacts: the aggregated file is generated, never
 * hand-edited, so the standalone and aggregate views cannot drift. The
 * composition test (`tests/composition.mjs`) verifies the committed files
 * match this render.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { META_HEADER, emitPatch } from './patch-emitter.mjs'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const root = join(scriptsDir, '..')

/** Feature packages in stable aggregation order. */
const FEATURES = ['preset']

/**
 * Import one feature's patch source (default export: the patch data array).
 *
 * CJS compatibility: `import()` of a CommonJS module yields a namespace whose
 * `default` is `module.exports` — so `module.default` is the array for both a
 * CJS `module.exports = [...]` and an ESM `export default [...]`. The
 * `?? module` fallback additionally covers a module that only exposes the
 * array via the namespace object itself (no default at all); if neither is an
 * array we fail loudly rather than emit an empty patch.
 */
async function loadFeature(name) {
  const module = await import(join(root, 'packages', name, 'cordis.patch.js'))
  const data = module.default ?? module
  if (!Array.isArray(data)) {
    throw new Error(`compose-patch: packages/${name}/cordis.patch.js must export an array (module.exports or default export)`)
  }
  return data
}

/**
 * Emit every feature's standalone patch plus the aggregated meta patch.
 * @returns {{ meta: string, features: Record<string, string> }} the rendered documents.
 */
export async function composePatches() {
  const rendered = {}
  const all = []
  for (const name of FEATURES) {
    const data = await loadFeature(name)
    rendered[name] = emitPatch(data)
    all.push(...data)
  }
  const meta = META_HEADER + emitPatch(all)
  return { meta, features: rendered }
}

/**
 * Write the composed patches to disk (used by the root build).
 */
export async function writeComposedPatches() {
  const { meta, features } = await composePatches()
  for (const [name, text] of Object.entries(features)) {
    writeFileSync(join(root, 'packages', name, 'cordis.patch.yml'), text)
  }
  writeFileSync(join(root, 'cordis.patch.yml'), meta)
}
