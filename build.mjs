/**
 * Root build — builds every feature package's `lib/` (Template Method via
 * scripts/build-package.mjs) and regenerates every `cordis.patch.yml`
 * (Composition Root via scripts/compose-patch.mjs), so the committed patch
 * files always match the per-feature patch sources.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPackage } from './scripts/build-package.mjs'
import { writeComposedPatches } from './scripts/compose-patch.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))

const packagesDir = join(root, 'packages')
if (!existsSync(packagesDir)) {
  console.error('build.mjs: no packages/ directory — merge the subpackage branches (feat/preset-pkg, feat/skills-pkg) first')
  process.exit(1)
}

const names = readdirSync(packagesDir).filter((name) => !name.startsWith('.') && !name.endsWith('.tmp'))
for (const name of names) {
  buildPackage(join(packagesDir, name))
}
await writeComposedPatches()
console.log(`dsh-coteam: built ${names.length} packages (lib/ + cordis.patch.yml)`)
