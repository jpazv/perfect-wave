// Inventário de skills para o pane: o motor lista os comandos; aqui só agrupa e filtra.
import type { Achado, Skill } from '../types'
export type { Achado, Skill }

// prefixo (ou plugin) → grupo; o primeiro que casar vence
export const GRUPOS: [RegExp, string][] = [
  [/^firecrawl/, 'Firecrawl'],
  [/marketing|^ads?\b|^ad-|copywriting|copy-edit|^seo|^cro|^ab-test|^email|^social|^content|^launch|^pricing|^referral|^paid-|customer-research|^lead-|^onboarding|^paywall|^popup|^signup|^form-cro|^page-cro|^schema/, 'Marketing'],
  [/impeccable|design|ui-|banner|brand|slides|dataviz|artifact/, 'Design'],
  [/^anthropic-skills:|docx|pdf|pptx|xlsx|docs/, 'Documents'],
  [/^ponytail|review|simplify|tdd|diagnos|codebase|domain|graphify|security|init|prototype|merge/, 'Code'],
]

export function grupoDe(s: Skill): string {
  const nome = s.name.toLowerCase()
  return GRUPOS.find(([r]) => r.test(nome) || (s.plugin && r.test(s.plugin.toLowerCase())))?.[1] ?? 'Other'
}

export function agrupar(skills: Skill[], filtro = ''): [string, Skill[]][] {
  const f = filtro.trim().toLowerCase()
  const visiveis = f ? skills.filter(s => s.name.toLowerCase().includes(f) || s.description.toLowerCase().includes(f)) : skills
  const mapa = new Map<string, Skill[]>()
  for (const s of [...visiveis].sort((a, b) => a.name.localeCompare(b.name))) {
    const g = grupoDe(s)
    mapa.set(g, [...(mapa.get(g) ?? []), s])
  }
  const ordem = [...GRUPOS.map(g => g[1]), 'Other']
  return [...mapa.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
}


export function lerBusca(json: string): Achado[] {
  try {
    const d = JSON.parse(json) as { skills?: Partial<Achado>[] }
    const limpo = (v: unknown) => String(v ?? '').replace(/[^\w./@:-]/g, '').slice(0, 120)
    return (d.skills ?? [])
      .map(s => ({ id: limpo(s.id), source: limpo(s.source), skillId: limpo(s.skillId ?? s.name), name: limpo(s.name), installs: Number(s.installs) || 0 }))
      .filter(s => s.source && s.skillId)
      .sort((a, b) => b.installs - a.installs)
  } catch { return [] }
}

export const fmtInstalls = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)).replace('.0', '')

/** Caminho do SKILL.md da skill na árvore do repositório (git/trees da API do GitHub). */
export function caminhoSkillMd(arvore: string, skillId: string): string | null {
  try {
    const paths = ((JSON.parse(arvore) as { tree?: { path: string }[] }).tree ?? []).map(t => t.path)
    return paths.find(p => p.endsWith(`/${skillId}/SKILL.md`)) ?? (paths.includes('SKILL.md') ? 'SKILL.md' : null)
  } catch { return null }
}
