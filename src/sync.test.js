// Tests for src/sync.js and src/schema.js, run with `node --test`.

'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { syncOnePreset, syncPresetTrees } = require('./sync.js')
const { validateAgentCordis } = require('./schema.js')

/** Minimal structurally valid agent.cordis.yml used by the sync fixtures. */
const VALID_AGENT_YAML = "- id: persona\n  name: '@deepseek-ai/dsh-persona'\n"

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-coteam-'))
  const source = path.join(base, 'presets')
  const target = path.join(base, 'agent-presets')
  fs.mkdirSync(path.join(source, 'team-leader'), { recursive: true })
  fs.writeFileSync(path.join(source, 'team-leader', 'agent.cordis.yml'), VALID_AGENT_YAML)
  fs.writeFileSync(path.join(source, 'team-leader', 'leader-guard.js'), 'module.exports = {}\n')
  fs.writeFileSync(path.join(source, 'team-leader', 'preset.yml'), 'name: 小组长模式\n')
  return { source, target, dispose: () => fs.rmSync(base, { recursive: true, force: true }) }
}

test('syncPresetTrees copies the bundled preset tree into the target root', () => {
  const f = fixture()
  try {
    const result = syncPresetTrees(f.source, f.target)
    assert.deepEqual(result.synced, ['team-leader'])
    assert.deepEqual(result.current, [])
    assert.deepEqual(result.failed, [])
    assert.ok(fs.readFileSync(path.join(f.target, 'team-leader', 'preset.yml'), 'utf8').includes('小组长模式'))
    assert.ok(fs.readFileSync(path.join(f.target, 'team-leader', 'leader-guard.js'), 'utf8').includes('module.exports'))
  } finally { f.dispose() }
})

test('syncPresetTrees is idempotent — a second run copies nothing', () => {
  const f = fixture()
  try {
    syncPresetTrees(f.source, f.target)
    const second = syncPresetTrees(f.source, f.target)
    assert.deepEqual(second.synced, [])
    assert.deepEqual(second.current, ['team-leader'])
  } finally { f.dispose() }
})

test('syncPresetTrees rewrites the tree when a file changed', () => {
  const f = fixture()
  try {
    syncPresetTrees(f.source, f.target)
    fs.writeFileSync(path.join(f.target, 'team-leader', 'agent.cordis.yml'), 'changed\n')
    const third = syncPresetTrees(f.source, f.target)
    assert.deepEqual(third.synced, ['team-leader'])
    assert.equal(fs.readFileSync(path.join(f.target, 'team-leader', 'agent.cordis.yml'), 'utf8'), VALID_AGENT_YAML)
  } finally { f.dispose() }
})

test('syncPresetTrees retires a previously bundled preset directory removed from the source', () => {
  const f = fixture()
  try {
    syncPresetTrees(f.source, f.target)
    fs.mkdirSync(path.join(f.target, 'team-leader-exact'), { recursive: true })
    fs.writeFileSync(path.join(f.target, 'team-leader-exact', 'agent.cordis.yml'), VALID_AGENT_YAML)
    const result = syncPresetTrees(f.source, f.target, ['team-leader-exact'])
    assert.deepEqual(result.retired, ['team-leader-exact'])
    assert.equal(fs.existsSync(path.join(f.target, 'team-leader-exact')), false)
    assert.equal(fs.existsSync(path.join(f.target, 'team-leader')), true)
  } finally { f.dispose() }
})

test('syncPresetTrees never touches directories it does not own', () => {
  const f = fixture()
  try {
    syncPresetTrees(f.source, f.target)
    fs.mkdirSync(path.join(f.target, 'user-authored'), { recursive: true })
    fs.writeFileSync(path.join(f.target, 'user-authored', 'x.txt'), 'mine\n')
    const result = syncPresetTrees(f.source, f.target)
    assert.deepEqual(result.synced, [])
    assert.equal(fs.readFileSync(path.join(f.target, 'user-authored', 'x.txt'), 'utf8'), 'mine\n')
  } finally { f.dispose() }
})

test('syncPresetTrees removes target files whose source file was deleted', () => {
  const f = fixture()
  try {
    syncPresetTrees(f.source, f.target)
    fs.rmSync(path.join(f.source, 'team-leader', 'leader-guard.js'))
    const second = syncPresetTrees(f.source, f.target)
    assert.deepEqual(second.synced, ['team-leader'])
    assert.equal(fs.existsSync(path.join(f.target, 'team-leader', 'leader-guard.js')), false)
  } finally { f.dispose() }
})

test('syncPresetTrees rewrites a same-size, same-mtime file whose bytes differ', () => {
  const f = fixture()
  try {
    syncPresetTrees(f.source, f.target)
    const source = path.join(f.source, 'team-leader', 'agent.cordis.yml')
    const dest = path.join(f.target, 'team-leader', 'agent.cordis.yml')
    const sourceText = fs.readFileSync(source, 'utf8')
    fs.writeFileSync(dest, sourceText.replace('persona', 'parsena'))
    const stat = fs.statSync(source)
    fs.utimesSync(dest, stat.atime, stat.mtime)
    assert.equal(fs.statSync(dest).size, stat.size)
    assert.ok(Math.abs(fs.statSync(dest).mtimeMs - stat.mtimeMs) < 1)
    const second = syncPresetTrees(f.source, f.target)
    assert.deepEqual(second.synced, ['team-leader'])
    assert.equal(fs.readFileSync(dest, 'utf8'), VALID_AGENT_YAML)
  } finally { f.dispose() }
})

test('syncPresetTrees reports an invalid bundled preset as failed instead of synced', () => {
  const f = fixture()
  try {
    fs.writeFileSync(path.join(f.source, 'team-leader', 'agent.cordis.yml'), 'rows: []\n')
    const result = syncPresetTrees(f.source, f.target)
    assert.deepEqual(result.synced, [])
    assert.deepEqual(result.current, [])
    assert.equal(result.failed.length, 1)
    assert.equal(result.failed[0].id, 'team-leader')
    assert.ok(result.failed[0].error.includes('failed validation'))
  } finally { f.dispose() }
})

test('validateAgentCordis accepts a valid row and rejects broken ones', () => {
  assert.deepEqual(validateAgentCordis(VALID_AGENT_YAML), [])
  // Missing name
  assert.deepEqual(validateAgentCordis('- id: persona\n'), ['row "persona": missing "name" key'])
  // Bad name prefix
  assert.deepEqual(
    validateAgentCordis("- id: persona\n  name: 'not-prefixed'\n"),
    ['row "persona": name "not-prefixed" must start with "./", "@" or "cordis:"'],
  )
  // group true without cordis:group
  assert.deepEqual(
    validateAgentCordis("- id: g\n  name: '@x/y'\n  group: true\n"),
    ['row "g": "group: true" requires name "cordis:group"'],
  )
  // duplicate id
  assert.deepEqual(
    validateAgentCordis("- id: a\n  name: '@x/y'\n- id: a\n  name: '@x/y'\n"),
    ['line 3: duplicate row id "a"'],
  )
})
