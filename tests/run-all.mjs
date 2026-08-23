/**
 * Test runner — executes every package test plus the repo-wide guardrail
 * (composition) in one command: `npm test`.
 *
 * Each step is a plain node invocation that exits non-zero on failure, so this
 * runner is just an ordered spawner with a summary; a failing step stops the
 * run (fail fast) so the failure surface stays small.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const steps = [
  ['node', ['tests/composition.mjs'], 'composition guard'],
  ['node', ['--test', 'packages/preset/tests/*.test.js'], 'preset subpackage tests'],
  ['node', ['--test', 'packages/skills/tests/*.test.js'], 'skills subpackage tests'],
]

console.log(`running ${steps.length} test steps\n`)
let failed = 0
for (const [cmd, args, label] of steps) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`✗ ${label}`)
    failed += 1
    break
  }
  console.log(`✓ ${label}`)
}

if (failed > 0) {
  console.error(`test suite failed: ${failed} step(s) failed`)
  process.exit(1)
}
console.log('all test steps passed')
