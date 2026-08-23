/**
 * Per-package build — the shared Template Method every feature package's
 * `build` script runs, and the root build orchestrates over all packages.
 *
 * dsh-coteam adaptation of the better-webui pipeline:
 *   1. host files (`src/*.js`) are copied verbatim to `lib/` — no compiler,
 *      so CommonJS stays CommonJS and ESM stays ESM (the preset subpackage is
 *      CJS on purpose: `leader-guard.js` is `module.exports`, and switching
 *      `"type": "module"` would break it);
 *   2. `src/host.js` is special-cased to `lib/index.js` (the package main);
 *   3. `src/client.bundle.js` (if present) is wrapped into the
 *      `window.__ModuleLoader__.load` factory envelope and emitted as
 *      `lib/client.js`. No dsh-coteam package ships a client half today, but
 *      the branch is kept for parity with better-webui and harmless.
 *   4. `*.test.js` files are skipped — tests live in `tests/` and never enter
 *      the build output.
 *
 * Packages without a `src/` directory (pure content packages) are skipped,
 * not an error.
 *
 * Factory contract (ClientModuleSystem.materialize): the factory's RETURN
 * value is the module's exports, and the body runs as factory-form CJS — it
 * must declare its own `module`/`exports` prologue and end with
 * `return module.exports`, exactly like the official clientBundle output.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Wrap a client-bundle body in the loader envelope, keyed by the package id. */
function envelope(id, body) {
  return `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {\n`
    + `var module = { exports: {} };\nvar exports = module.exports;\n`
    + `Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });\n`
    + `${body}\nreturn module.exports;\n} });\n`
}

/**
 * Build one feature package's `lib/` from its `src/`.
 * @param {string} pkgDir - absolute package directory.
 */
export function buildPackage(pkgDir) {
  const srcDir = join(pkgDir, 'src')
  const libDir = join(pkgDir, 'lib')
  if (!existsSync(srcDir)) {
    // Pure content package (e.g. a future skills-only dir): nothing to build.
    console.log(`build-package: ${pkgDir} has no src/ — skipping (pure content package)`)
    return
  }
  // Deterministic outputs: wipe lib/ first so stale files from an earlier
  // layout never leak into the built package.
  rmSync(libDir, { recursive: true, force: true })
  mkdirSync(libDir, { recursive: true })
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const id = manifest.name
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`build-package: ${pkgDir} has no package name`)
  }
  for (const file of readdirSync(srcDir).sort()) {
    if (!file.endsWith('.js')) continue
    if (file.endsWith('.test.js')) continue
    if (file === 'client.bundle.js') {
      const body = readFileSync(join(srcDir, file), 'utf8')
      writeFileSync(join(libDir, 'client.js'), envelope(id, body))
    } else if (file === 'host.js') {
      // The package main is always lib/index.js, regardless of the src name.
      copyFileSync(join(srcDir, file), join(libDir, 'index.js'))
    } else {
      copyFileSync(join(srcDir, file), join(libDir, file))
    }
  }
}

// CLI entry: `node scripts/build-package.mjs [packageDir]` (default: cwd).
// Feature packages run this from their own dir: `node ../../scripts/build-package.mjs .`
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2] ?? '.'
  buildPackage(resolve(target))
  console.log(`build-package: built ${resolve(target)}`)
}
