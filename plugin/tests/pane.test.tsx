import { expect, mock, test } from 'claude-code/testing'

const PROJ = '/Users/me/dev/demo'
const ARQ: Record<string, string> = {}

const espera = async () => { for (let i = 0; i < 50; i++) await Promise.resolve() }

function fakeEngine(on: any, extra: { fills?: string[]; runs?: string[][]; toasts?: string[]; rede?: (a: string) => string | null; lista?: (p: string) => unknown[] } = {}) {
  on('command.register', () => ({ value: undefined }))
  on('command.list', () => ({ value: [{ name: 'tdd', description: 'Test-driven development loop', source: 'user' }, { name: 'help', description: '', source: 'builtin' }] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  mock.clock(on)
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_: any, e: any) => { extra.toasts?.push(e.text); return { value: undefined } })
  on('ui.log', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('fs.read', (_: any, e: any) => (e.path in ARQ ? { value: ARQ[e.path] } : { deny: 'ENOENT' }))
  on('fs.list', (_: any, e: any) => ({ value: extra.lista?.(e.path) ?? [] }))
  on('prompt.fill', (_: any, e: any) => { extra.fills?.push(e.text); return { isFilled: true } })
  on('process.run', (_: any, e: any) => {
    extra.runs?.push([...e.argv])
    const a = e.argv.join(' ')
    if (a === 'printenv HOME') return { value: { exitCode: 0, stdout: '/Users/me\n', stderr: '' } }
    const r = extra.rede?.(a)
    if (r != null) return { value: { exitCode: 0, stdout: r, stderr: '' } }
    return { value: { exitCode: 1, stdout: '', stderr: 'no network in tests' } }
  })
  on('tool.check', () => ({ decision: 'allow' }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'motor', scope: 'shared' }] }))
  on('ui.render', ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>motor</Text> })
}

test('engine guardrails: force push denied, main asks, subagent asks', async ($, on) => {
  fakeEngine(on)
  await $.session.start({ cwd: PROJ, surface: 'terminal', isInteractive: true })
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git push --force' } })).decision).toBe('deny')
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git push origin HEAD:main' } })).decision).toBe('ask')
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git status' } })).decision).toBe('allow')
  expect((await $.tool.check({ tool: 'Agent', input: { prompt: 'x' } })).decision).toBe('ask')
})

const PANE = { plugin: 'perfect-wave', component: 'Pane', requestId: 'perfect-wave', props: { title: 'Perfect Wave', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } } as const

test('Skills tab: a click fills /skill in the prompt; builtins stay out', async ($, on) => {
  const fills: string[] = []
  fakeEngine(on, { fills })
  await $.session.start({ cwd: '/Users/me', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'wave', args: 'skills' })
  await espera()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /help/ })).toBe(undefined)
  await $.ui.press({ plugin: 'perfect-wave', key: 's:tdd' })
  expect(fills).toEqual(['/tdd '])
  await ui.unmount()
})

test('Hunter tab: no Install button before review, and nothing runs npx', async ($, on) => {
  const runs: string[][] = []
  fakeEngine(on, { runs, rede: a => (a.includes('skills.sh/api/search') ? '{"skills":[{"id":"v/s/find-skills","source":"vercel-labs/skills","skillId":"find-skills","name":"find-skills","installs":3991286}]}' : null) })
  await $.session.start({ cwd: '/Users/me', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'wave', args: 'hunter' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await $.ui.input({ plugin: 'perfect-wave', key: 'busca', text: 'skills' })
  await espera()
  expect((await ui.find({ type: 'Text', text: /4M/ })) !== undefined).toBe(true)
  expect(await ui.find({ type: 'Button', key: 'ins:v/s/find-skills' })).toBe(undefined)
  expect((await ui.find({ type: 'Button', key: 'rev:v/s/find-skills' })) !== undefined).toBe(true)
  expect(runs.some(r => r.includes('npx'))).toBe(false)
  await ui.unmount()
})

test('all four tabs render in the terminal and the desktop', async ($, on) => {
  fakeEngine(on)
  await $.session.start({ cwd: PROJ, surface: 'terminal', isInteractive: true })
  for (const [aba, marca] of [['skills', /Code/], ['files', /FILES · demo/], ['hunter', /Skill hunter/], ['status', /Tokens this session/]] as const) {
    await $.command.run({ command: 'wave', args: aba })
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect([aba, surface, (await ui.find({ type: 'Text', text: marca })) !== undefined]).toEqual([aba, surface, true])
      await ui.unmount()
    }
  }
})

test('effort button changes the router mode and notifies', async ($, on) => {
  const toasts: string[] = []
  fakeEngine(on, { toasts })
  await $.session.start({ cwd: '/Users/me', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'wave', args: 'status' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await $.ui.press({ plugin: 'perfect-wave', key: 'ef:high' })
  expect(toasts.some(t => t.includes('high'))).toBe(true)
  await ui.unmount()
})

test('Ponytail card: a checkbox writes the ponytail config.json keeping its other fields', async ($, on) => {
  const gravados: string[] = []
  ARQ['/Users/me/.config/ponytail/config.json'] = '{"defaultMode":"lite","outro":1}'
  fakeEngine(on)
  on('fs.write', (_: any, e: any) => { gravados.push(String(e.content ?? e.data ?? e.text)); return { value: undefined } })
  await $.session.start({ cwd: '/Users/me', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'wave', args: 'status' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /default lite/ })) !== undefined).toBe(true)
  await $.ui.press({ plugin: 'perfect-wave', key: 'pt:status' })
  await espera()
  expect(JSON.parse(gravados[0] ?? '{}')).toEqual({ defaultMode: 'lite', outro: 1, hideStatus: true })
  await ui.unmount()
  delete ARQ['/Users/me/.config/ponytail/config.json']
})

test('Files tab follows the session: root = cwd; a touched file inside it is revealed', async ($, on) => {
  let cwd = '/Users/me'
  const DIRS: Record<string, unknown[]> = { [PROJ]: [{ name: 'plugins', kind: 'dir', size: 0 }], [`${PROJ}/plugins`]: [{ name: 'src', kind: 'dir', size: 0 }], [`${PROJ}/plugins/src`]: [{ name: 'a.ts', kind: 'file', size: 1 }] }
  fakeEngine(on, { lista: p => DIRS[p] ?? [] })
  on('tool.call', () => ({ isError: false, result: 'ok', text: 'ok' }))
  on('session.cwd', () => ({ value: cwd }))
  await $.session.start({ cwd, surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'wave', args: 'files' })
  const textos = async () => { const ui = await $.ui.mount({ ...PANE, surface: 'terminal' }); const t = JSON.stringify(await ui.findAll({})); await ui.unmount(); return t }
  cwd = PROJ
  await $.tool.call({ tool: 'Bash', command: 'cd ~/dev/demo && ls' } as any)
  await espera()
  expect((await textos()).includes('"plugins"')).toBe(true)
  await $.tool.call({ tool: 'Edit', file_path: `${PROJ}/plugins/src/a.ts`, old_string: 'a', new_string: 'b' } as any)
  await espera()
  expect((await textos()).includes('a.ts')).toBe(true) // folders opened down to the file
  await $.tool.call({ tool: 'Read', file_path: '/private/tmp/fora.md' } as any)
  await espera()
  expect((await textos()).includes('fora.md')).toBe(false) // outside the root: untouched
})
