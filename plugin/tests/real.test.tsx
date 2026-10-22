import { expect, mock, test } from 'claude-code/testing'

const PANE = { plugin: 'perfect-wave', component: 'Pane', requestId: 'perfect-wave', props: { title: 'Perfect Wave', isFocused: true, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } } as const

test('every tab renders with realistic data', async ($, on) => {
  const clock = mock.clock(on)
  on('command.register', () => ({ value: undefined }))
  on('command.list', () => ({ value: [{ name: 'tdd', description: 'Inspect &lt;id&gt;', source: 'user' }] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  for (const ev of ['ui.status', 'ui.toast', 'ui.log']) on(ev, () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 1, context: { tokens: 460000, window: 1000000, percent: 46, breakdown: { categories: [{ name: 'Messages', tokens: 400000, color: 'claude', isDeferred: false, kind: 'messages' }, { name: 'MCP tools (deferred)', tokens: 300000, color: 'rgb(177,185,249)', isDeferred: true, kind: 'mcp' }], totalTokens: 460000, maxTokens: 1000000, rawMaxTokens: 1000000, autocompactSource: 'default', percentage: 46 } }, rateLimits: [{ kind: 'five_hour', percentUsed: 62, resetsAt: '2030-01-01T00:00:00Z' }], cost: { usd: 24.17 } } }))
  on('fs.read', () => ({ deny: 'ENOENT' }))
  on('fs.list', () => ({ value: [{ name: 'hooks', kind: 'dir', size: 0 }, { name: 'a.ts', kind: 'file', size: 1 }, { name: 'clean.md', kind: 'file', size: 1 }] }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 1792695541782, isLink: false } }))
  on('process.run', (_: any, e: any) => ({ value: { exitCode: 0, stdout: e.argv[0] === 'printenv' ? '/u' : e.argv.includes('status') ? '## main...origin/main [ahead 2]\n M a.ts' : e.argv.includes('rev-parse') ? '/w' : '', stderr: '' } }))
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await clock.advance(10000) // one poll: the Files tree has items (one file without a git mark among them)
  for (const aba of ['skills', 'files', 'hunter', 'status']) {
    await $.command.run({ command: 'wave', args: aba })
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    const tudo = await ui.findAll({ type: 'Text' })
    expect([aba, tudo.length > 3]).toEqual([aba, true])
    await ui.unmount()
  }
})
