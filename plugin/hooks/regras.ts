// Guardrails applied by the engine (tool.check): the verdict is computed here, pure, so it can be tested by table.
export type Veredito = { decision: 'allow' | 'ask' | 'deny'; reason: string }

const SEP = /&&|\|\||;|\||\n/
const RAMO_PROTEGIDO = /^(?:\+?(?:[^:\s]+:)?(?:refs\/heads\/)?)(main|master)$/

// Separa o comando em trechos e cada trecho em palavras (aspas simples/duplas preservadas).
export function trechos(comando: string): string[][] {
  return comando.split(SEP).map(t => t.match(/'[^']*'|"[^"]*"|\S+/g) ?? []).filter(p => p.length > 0)
}

const ehGitPush = (p: string[]) => {
  const g = p.indexOf('git')
  if (g < 0) return false
  // pula opções globais do git (-C dir, -c k=v) até achar o subcomando
  for (let i = g + 1; i < p.length; i++) {
    const w = p[i] ?? ''
    if (w === '-C' || w === '-c') { i++; continue }
    if (w.startsWith('-')) continue
    return w === 'push'
  }
  return false
}

export function forcaPush(comando: string): boolean {
  return trechos(comando).some(p => ehGitPush(p) && p.some(w =>
    w === '--force' || w.startsWith('--force-with-lease') || w === '--mirror' ||
    /^-[a-zA-Z]*f[a-zA-Z]*$/.test(w) ||                      // -f, -fu, -uf
    (/^\+[^\s-]/.test(w))))                                   // +main, +HEAD:main
}

export function pushParaProtegido(comando: string): boolean {
  return trechos(comando).some(p => ehGitPush(p) && p.slice(p.indexOf('push') + 1).some(w => !w.startsWith('-') && RAMO_PROTEGIDO.test(w)))
}

export const mergeDePr = (comando: string) => trechos(comando).some(p => p.join(' ').includes('gh pr merge'))

/** null: the rule does not apply (the engine decides as usual). */
export function vereditoBash(comando: string): Veredito | null {
  if (forcaPush(comando)) return { decision: 'deny', reason: 'Perfect Wave: force push is blocked (resolve divergence with a merge, never by rewriting the remote).' }
  if (mergeDePr(comando)) return { decision: 'ask', reason: 'Perfect Wave: merging a pull request. Approve?' }
  if (pushParaProtegido(comando)) return { decision: 'ask', reason: 'Perfect Wave: pushing straight to main/master. Approve?' }
  return null
}

export const vereditoSubagente = (tool: string): Veredito | null =>
  tool === 'Agent' || tool === 'Task' || tool === 'Workflow'
    ? { decision: 'ask', reason: 'Perfect Wave: a subagent can burn 90k+ tokens in seconds. Approve this one?' }
    : null
