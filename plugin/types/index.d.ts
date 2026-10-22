export type Skill = { name: string; description: string; plugin?: string }
// Achado do skills.sh (/api/search): o mesmo índice do `npx skills find`
export type Achado = { id: string; source: string; skillId: string; name: string; installs: number }
export type Mudanca = { caminho: string; tipo: 'novo' | 'alterado' | 'removido'; em: number }

export type Aba = 'skills' | 'files' | 'hunter' | 'status'
export type Item = { nome: string; dir: boolean; mtime: number }
export type Arvore = Record<string, Item[] | { total: number }>
export type Info = { esforco: string }
export type Ramo = { ramo: string; upstream: string; frente: number; atras: number }
export type Req = { effort: string; input: number; output: number; cacheRead: number; cacheWrite: number }
export type Uso = { requisicoes: number; ajustadas: number; input: number; output: number; cacheRead: number; cacheWrite: number; haiku: number; haikuTokens: number; porEsforco: Record<string, { req: number; output: number }>; ultimas: Req[] }
export type Turnos = { n: number; ms: number; ultimos: { texto: string; esforco: string; ms: number }[] }
export type Hunter = { termo: string; achados: Achado[]; revisados: string[]; instalados: string[]; estado: string }

declare module 'claude-code' {
  interface PluginState {
    'perfect-wave': {
      aba: Aba
      filtro: string
      skills: Skill[]
      info: Info
      raizes: string[]
      abertos: string[]
      arvore: Arvore
      feed: Mudanca[]
      tocando: string
      git: Record<string, { mais: number; menos: number; n: number; marca: string }>
      hunter: Hunter
      raiz: string
      cursor: string
      busca: string
      ramo: Ramo | null
      uso: Uso
      modo: string
      grupo: string
      turnos: Turnos
      sessao: unknown
      ponytail: Record<string, unknown>
    }
  }
}
