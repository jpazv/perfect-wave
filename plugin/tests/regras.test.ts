import { expect, test } from 'claude-code/testing'
import { vereditoBash, vereditoSubagente } from '../hooks/regras.ts'

const TABLE: [string, 'allow' | 'ask' | 'deny' | null][] = [
  ['git push', null],
  ['git push origin feat/x', null],
  ['git push -u origin feat/x', null],
  ['git push --force', 'deny'],
  ['git push -f origin feat/x', 'deny'],
  ['git push -fu origin feat/x', 'deny'],
  ['git push --force-with-lease', 'deny'],
  ['git push --force-with-lease=main:abc origin main', 'deny'],
  ['git push origin +feat/x', 'deny'],
  ['git -C ~/dev/x push --force', 'deny'],
  ['cd a && git push --force', 'deny'],
  ['git push origin main', 'ask'],
  ['git push origin HEAD:main', 'ask'],
  ['git push origin bee721e:refs/heads/master', 'ask'],
  ['gh pr merge 45 --squash', 'ask'],
  ['git log --oneline main', null],
  ['echo "git push --force"', null],
  ['git fetch -f origin', null],
  ['git push origin feat/main-fix', null],
]

test('command table: force push denied, merge/main asks, the rest passes', () => {
  for (const [cmd, expected] of TABLE) {
    expect([cmd, vereditoBash(cmd)?.decision ?? null]).toEqual([cmd, expected])
  }
})

test('subagents always ask; other tools do not', () => {
  expect(vereditoSubagente('Agent')?.decision).toBe('ask')
  expect(vereditoSubagente('Workflow')?.decision).toBe('ask')
  expect(vereditoSubagente('Bash')).toBe(null)
})
