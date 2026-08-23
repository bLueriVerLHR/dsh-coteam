// skills 子包内容完整性测试。
// 验证核心交付 skills/grill-me/SKILL.md 存在，且 frontmatter 含 name 与 description。
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const skillFile = path.join(root, 'skills', 'grill-me', 'SKILL.md')

test('skills/grill-me/SKILL.md exists', () => {
  assert.ok(fs.existsSync(skillFile), `missing ${path.relative(root, skillFile)}`)
})

test('SKILL.md frontmatter declares name: grill-me', () => {
  const content = fs.readFileSync(skillFile, 'utf8')
  const fm = /^---\n([\s\S]*?)\n---/.exec(content)
  assert.ok(fm, 'frontmatter block (--- ... ---) not found')
  assert.match(fm[1], /^name:\s*grill-me$/m, 'frontmatter must contain name: grill-me')
})

test('SKILL.md frontmatter declares description', () => {
  const content = fs.readFileSync(skillFile, 'utf8')
  const fm = /^---\n([\s\S]*?)\n---/.exec(content)
  assert.ok(fm, 'frontmatter block (--- ... ---) not found')
  assert.match(fm[1], /^description:/m, 'frontmatter must contain a description field')
})

test('SKILL.md body is non-empty and includes core workflow sections', () => {
  const content = fs.readFileSync(skillFile, 'utf8')
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, '')
  assert.ok(body.trim().length > 0, 'body must be non-empty')
  for (const section of ['核心原则', '工作流程', 'frontier']) {
    assert.ok(body.includes(section), `body must mention "${section}"`)
  }
})
