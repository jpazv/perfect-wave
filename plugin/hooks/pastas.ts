// Aba Pastas: compara duas fotos de uma pasta (nome → mtime) e gera os eventos do feed.
export type Foto = Record<string, { mtime: number; dir: boolean }>
import type { Mudanca } from '../types'
export type { Mudanca }

export const IGNORAR = new Set(['node_modules', '.git', 'coverage', 'dist', '.DS_Store', '.next', '__pycache__'])
export const MAX_ENTRADAS = 300 // acima disso a pasta mostra só "N itens"

export function diferencas(pasta: string, antes: Foto | undefined, agora: Foto, em: number): Mudanca[] {
  if (!antes) return [] // primeira foto: nada mudou ainda
  const j = (n: string) => `${pasta}/${n}`
  const out: Mudanca[] = []
  for (const [n, v] of Object.entries(agora)) {
    if (!antes[n]) out.push({ caminho: j(n), tipo: 'novo', em })
    else if (!v.dir && v.mtime !== antes[n].mtime) out.push({ caminho: j(n), tipo: 'alterado', em })
  }
  for (const n of Object.keys(antes)) if (!agora[n]) out.push({ caminho: j(n), tipo: 'removido', em })
  return out
}

export const nomeCurto = (caminho: string, home: string) => (caminho.startsWith(home) ? '~' + caminho.slice(home.length) : caminho)

// ---- navegação (aba Pastas no estilo do filetree: j/k/h/l/o, cursor numa lista achatada) ----
export type Linha = { caminho: string; nome: string; dir: boolean; nivel: number; aberto: boolean }
type Arv = Record<string, { nome: string; dir: boolean }[] | { total: number }>

/** A árvore visível a partir da raiz, só descendo nas pastas abertas; com busca, só o que casa (e suas pastas). */
export function achatar(raiz: string, arv: Arv, abertos: string[], busca = ''): Linha[] {
  const b = busca.trim().toLowerCase()
  const out: Linha[] = []
  const desce = (pasta: string, nivel: number): boolean => {
    const itens = arv[pasta]
    if (!Array.isArray(itens)) return false
    let algum = false
    for (const i of itens) {
      const caminho = `${pasta}/${i.nome}`
      const aberto = i.dir && abertos.includes(caminho)
      const pos = out.length
      out.push({ caminho, nome: i.nome, dir: i.dir, nivel, aberto })
      const filhos = aberto ? desce(caminho, nivel + 1) : false
      const casa = !b || i.nome.toLowerCase().includes(b) || filhos
      if (!casa) out.splice(pos, 1)
      algum ||= casa
    }
    return algum
  }
  desce(raiz, 0)
  return out
}

/** "## main...origin/main [ahead 23, behind 2]" (git status -b --porcelain) → ramo, upstream e distâncias. */
export function lerRamo(linha: string): { ramo: string; upstream: string; frente: number; atras: number } | null {
  const m = /^## (?:No commits yet on )?([^.\s]+)(?:\.\.\.(\S+))?(?: \[(.*)\])?/.exec(linha)
  if (!m) return null
  const n = (k: string) => Number(new RegExp(`${k} (\\d+)`).exec(m[3] ?? '')?.[1] ?? 0)
  return { ramo: m[1] ?? '?', upstream: m[2] ?? '', frente: n('ahead'), atras: n('behind') }
}

// cor estável por nome de pasta (o quadradinho ■ do filetree); pastas ocultas apagadas
const CORES = ['suggestion', 'success', 'claude', 'warning', 'merged', 'permission'] as const
export const corPasta = (nome: string) =>
  nome.startsWith('.') ? 'inactive' : CORES[[...nome].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % CORES.length]!

export const pai = (p: string) => p.slice(0, Math.max(1, p.lastIndexOf('/'))) || '/'

export type Delta = { mais: number; menos: number; n: number; marca: string }

/** git status --porcelain + git diff --numstat → por arquivo e somado em cada pasta acima (a coluna da direita do filetree). */
export function agregarGit(topo: string, porcelana: string[], numstat: string): Record<string, Delta> {
  const out: Record<string, Delta> = {}
  const soma = (c: string, mais: number, menos: number, marca: string, conta: boolean) => {
    const d = (out[c] ??= { mais: 0, menos: 0, n: 0, marca })
    d.mais += mais; d.menos += menos; if (conta) d.n += 1
  }
  const linhas = new Map(numstat.split('\n').filter(Boolean).map(l => { const [a = '0', d = '0', ...p] = l.split('\t'); return [p.join('\t'), [Number(a) || 0, Number(d) || 0]] as const }))
  for (const l of porcelana) {
    const rel = l.slice(3).replace(/^"|"$/g, '').replace(/^.* -> /, '')
    const marca = l.slice(0, 2).trim() || 'M'
    const [mais, menos] = linhas.get(rel) ?? [0, 0]
    const caminho = `${topo}/${rel}`
    soma(caminho, mais, menos, marca, false)
    for (let p = caminho.slice(0, caminho.lastIndexOf('/')); p.length > topo.length; p = p.slice(0, p.lastIndexOf('/'))) soma(p, mais, menos, 'dir', true)
  }
  return out
}

/** Texto da coluna da direita: +mais −menos e a marca (pasta: M:n), ou a data de modificação. */
export function colunaDireita(d: Delta | undefined, mtime: number, dir: boolean): string {
  if (d) {
    const partes = [d.mais ? `+${d.mais}` : '', d.menos ? `−${d.menos}` : '', dir ? `M:${d.n}` : d.marca]
    return partes.filter(Boolean).join(' ')
  }
  if (dir || !mtime) return ''
  const t = new Date(mtime)
  const z = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${z(t.getMonth() + 1)}-${z(t.getDate())} ${z(t.getHours())}:${z(t.getMinutes())}`
}
