import { atom, read, update } from 'claude-code'
import type { Register, SessionUsage } from 'claude-code'

import type { Aba } from '../types'
import { definirModo, register as registerEsforco } from './effort/register.js'
import { vereditoBash, vereditoSubagente } from './regras.ts'
import { agrupar, fmtInstalls } from './skills.ts'
import { LARGURA_MASCOTE, mascoteDe, NIVEL_COR, RANK } from './mascotes.ts'
import { achatar, colunaDireita, corPasta, nomeCurto, pai, type Delta } from './pastas.ts'
import type { ArvoreProps, LinhaArvore, Seg } from './arvore.tsx'
import type { BrilhoProps } from './brilho.tsx'
import { iconeArquivo } from './icones.ts'
import * as N from './nucleo.tsx'
import { buscar, home, instalar, lerTexto, navegar, revisar, rodar } from './nucleo.tsx'
import type { Arvore, Hunter, Info, Item, Ramo, Turnos, Uso } from '../types'
import type { Skill } from './skills.ts'
import type { Mudanca } from './pastas.ts'

const P = 'perfect-wave' as const
const PANE = 'perfect-wave'
// os mesmos átomos do núcleo (mesmo plugin e chave): o motor quer a referência escrita em cada arquivo que lê ou escreve
const aba = atom({ plugin: 'perfect-wave', key: 'aba' } as const, 'skills' as Aba)
const filtro = atom({ plugin: 'perfect-wave', key: 'filtro' } as const, '')
const skills = atom({ plugin: 'perfect-wave', key: 'skills' } as const, [] as Skill[])
const info = atom({ plugin: 'perfect-wave', key: 'info' } as const, { esforco: '—' } as Info)
const raizes = atom({ plugin: 'perfect-wave', key: 'raizes' } as const, [] as string[])
const abertos = atom({ plugin: 'perfect-wave', key: 'abertos' } as const, [] as string[])
const arvore = atom({ plugin: 'perfect-wave', key: 'arvore' } as const, {} as Arvore)
const feed = atom({ plugin: 'perfect-wave', key: 'feed' } as const, [] as Mudanca[])
const tocando = atom({ plugin: 'perfect-wave', key: 'tocando' } as const, '')
const git = atom({ plugin: 'perfect-wave', key: 'git' } as const, {} as Record<string, Delta>)
const raiz = atom({ plugin: 'perfect-wave', key: 'raiz' } as const, '')
const cursor = atom({ plugin: 'perfect-wave', key: 'cursor' } as const, '')
const busca = atom({ plugin: 'perfect-wave', key: 'busca' } as const, '')
const ramo = atom({ plugin: 'perfect-wave', key: 'ramo' } as const, null as Ramo | null)
const uso = atom({ plugin: 'perfect-wave', key: 'uso' } as const, { requisicoes: 0, ajustadas: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, haiku: 0, haikuTokens: 0, porEsforco: {}, ultimas: [] } as Uso)
const modo = atom({ plugin: 'perfect-wave', key: 'modo' } as const, 'auto')
const turnos = atom({ plugin: 'perfect-wave', key: 'turnos' } as const, { n: 0, ms: 0, ultimos: [] } as Turnos)
const sessao = atom({ plugin: 'perfect-wave', key: 'sessao' } as const, null as unknown)
const ponytail = atom({ plugin: 'perfect-wave', key: 'ponytail' } as const, {} as Record<string, unknown>)

// config do ponytail (~/.config/ponytail/config.json): o mesmo arquivo que o plugin lê; mescla para não perder campos dele
const PONY_CFG = () => `${home}/.config/ponytail/config.json`
async function lerPonytail($: any): Promise<Record<string, unknown>> {
  try {
    const c = JSON.parse((await lerTexto($, PONY_CFG())) ?? '{}')
    return c && typeof c === 'object' && !Array.isArray(c) ? c : {}
  } catch { return {} }
}
async function configPonytail($: any, patch: Record<string, unknown>) {
  const c = { ...(await lerPonytail($)), ...patch }
  await rodar($, ['mkdir', '-p', `${home}/.config/ponytail`])
  try {
    await $.fs.write(PONY_CFG(), JSON.stringify(c, null, 2))
    await update($, ponytail, () => c)
    $.ui.toast('Ponytail: applies from the next session')
  } catch (error) {
    $.ui.toast(`Ponytail: could not save (${String((error as Error)?.message ?? error)})`)
  }
}
const grupo = atom({ plugin: 'perfect-wave', key: 'grupo' } as const, '')
const hunter = atom({ plugin: 'perfect-wave', key: 'hunter' } as const, { termo: '', achados: [], revisados: [], instalados: [], estado: '' } as Hunter)

// primeira leitura da janela 5h nesta sessão: o ritmo de consumo sai da diferença até agora
let leitura5h: { em: number; pct: number } | null = null

export const register: Register = on => {
  // the effort router; it calls the pane core on the events both use
  registerEsforco(on)

  // ---- guardrails ----
  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    const comando = String((e.input as { command?: unknown })?.command ?? '')
    return vereditoBash(comando) ?? next(e)
  }).catch(($, e, next) => next(e))

  on('tool.check', async ($, e, next) => vereditoSubagente(e.tool) ?? next(e)).catch(($, e, next) => next(e))

  // ---- comandos ----
  on('command.run', { command: 'wave' }, async ($, e) => {
    const [a = '', ...resto] = e.args.trim().split(/\s+/)
    if (['skills', 'files', 'hunter', 'status'].includes(a)) await update($, aba, () => a as Aba)
    if (a === 'skills' && resto.length) await update($, filtro, () => resto.join(' '))
    if (a === 'hunter' && resto.length) void buscar($, resto.join(' '))
    await $.ui.open({ id: PANE, title: 'Perfect Wave', focus: true })
    return {}
  })

  // cliques e teclas da árvore animada (módulo ./arvore.tsx)
  on('ui.message', async ($, e, next) => {
    if (e.requestId !== PANE || e.element !== 'arvore' || !e.data || typeof e.data !== 'object') return next(e)
    const d = e.data as { press?: unknown; key?: unknown }
    if (typeof d.press === 'string') await navegar($, 'clique', d.press)
    else if (typeof d.key === 'string') await navegar($, d.key)
    return {}
  })

  // ---- o pane: cartões de borda redonda, cores do tema, uma ação por linha (no estilo do flightdeck) ----
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    try { return await desenhar($, e) } catch (error) {
      const { Text } = $.ui.resolve(e)
      return <Text color="error">{`perfect-wave: the pane failed to render (${String((error as Error)?.message ?? error).slice(0, 200)})`}</Text>
    }
  })
}

// faixa do brilho do cartão de esforço, do apagado ao claro
const BRILHO: Record<string, string[]> = {
  low: ['#3f7d4e', '#5fb072', '#8fdca0', '#d6ffe0'],
  medium: ['#2f5f8a', '#4f8fc9', '#8cc4f2', '#dff0ff'],
  high: ['#8a6a1f', '#c99a2e', '#f2c45a', '#fff0c2'],
  xhigh: ['#8a2f2f', '#c94f4f', '#f28c8c', '#ffdede'],
  max: ['#8a2f2f', '#c94f4f', '#f28c8c', '#ffdede'],
}

async function desenhar($: any, e: any) {
  {
    const { Box, Text, Button, Input, Client } = $.ui.resolve(e) as any
    const W = Math.max(40, e.props?.bodyColumns ?? 60)
    const atual = await read($, aba)
    const inf = await read($, info)
    const abas: [Aba, string][] = [['skills', 'Skills'], ['files', 'Files'], ['hunter', 'Hunter'], ['status', 'Status']]
    const md = await read($, modo)
    const cartao = (cor: string, titulo: string, direita: any, corpo: any, key: string, largura = W) => (
      <Box key={key} flexDirection="column" borderStyle="round" borderColor={cor} paddingX={1} width={largura}>
        <Box justifyContent="space-between">
          <Text color={cor} bold>{titulo}</Text>
          {direita}
        </Box>
        {corpo}
      </Box>
    )
    const NIVEIS: [string, string][] = [['auto', 'auto'], ['low', 'low'], ['medium', 'med'], ['high', 'high'], ['xhigh', 'xhigh'], ['max', 'max']]
    // o nível que vale agora: o clicado à mão; no auto, o que a última requisição usou
    const nivel = RANK[md] ? md : RANK[inf.esforco] ? inf.esforco : 'medium'
    const mas = mascoteDe(nivel)
    const corNivel = NIVEL_COR[nivel] ?? 'claude'
    const pinta = (papel: string) => (papel === 'corpo' ? 'claude' : papel === 'fx' ? corNivel : papel === 'rastro' ? 'inactive' : undefined)
    const medidor = (r: number) => <Text><Text color={corNivel}>{'▰'.repeat(r)}</Text><Text color="subtle">{'▱'.repeat(5 - r)}</Text></Text>
    const cartaoEsforco = (
      <Box flexDirection="row" borderStyle="round" borderColor={corNivel} paddingX={1} width={W} columnGap={2}>
        <Box flexDirection="column" width={LARGURA_MASCOTE} flexShrink={0}>
          {mas.linhas.map((l, n) => <Text key={`m:${n}`} wrap="truncate">{l.map(([t, papel], k) => <Text key={`mp:${n}:${k}`} color={pinta(papel)}>{t}</Text>)}</Text>)}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <Box justifyContent="space-between">
            {Client
              ? <Client key={`brilho:${nivel}`} module="./brilho.tsx" width={`${nivel.toUpperCase()}  ${mas.nome}`.length} height={1} props={{ texto: `${nivel.toUpperCase()}  ${mas.nome}`, paleta: BRILHO[nivel] ?? BRILHO.medium!, negrito: true } satisfies BrilhoProps} />
              : <Text><Text color={corNivel} bold>{nivel.toUpperCase()}</Text><Text>{`  ${mas.nome}`}</Text></Text>}
            {Client
              ? <Client key={`medidor:${nivel}`} module="./brilho.tsx" width={5} height={1} props={{ texto: '▰'.repeat(RANK[nivel] ?? 2) + '▱'.repeat(5 - (RANK[nivel] ?? 2)), paleta: BRILHO[nivel] ?? BRILHO.medium! } satisfies BrilhoProps} />
              : medidor(RANK[nivel] ?? 2)}
          </Box>
          <Text color="inactive" wrap="truncate">{md === 'auto' ? `automatic · the router picks per request (last: ${inf.esforco})` : `pinned by you · applies from the next request`}</Text>
          <Text color="inactive" wrap="truncate">{mas.frase}</Text>
          <Box columnGap={1}>
            {NIVEIS.map(([v, rot]) => (
              <Button key={`ef:${v}`} plain onPress={() => { if (definirModo(v)) { void update($, modo, () => v); $.ui.toast(`Effort ${v}${v === 'auto' ? '' : ' from the next request'}`) } }}>
                <Text color={md === v ? (NIVEL_COR[v] ?? 'claude') : 'inactive'} bold={md === v} inverse={md === v}>{` ${rot} `}</Text>
              </Button>
            ))}
          </Box>
        </Box>
      </Box>
    )
    const cab = (
      <Box flexDirection="column" width={W}>
        <Box justifyContent="space-between">
          <Text><Text color="claude" bold>◆ Perfect Wave</Text><Text color="inactive">{`  ${N.cwd.split('/').pop() || '/'}`}</Text></Text>
        </Box>
        {cartaoEsforco}
        <Box columnGap={0} marginTop={1} flexWrap="nowrap">
          {abas.map(([id, nome], n) => (
            <Button key={`aba:${id}`} plain hotkey={String(n + 1)} onPress={() => void update($, aba, () => id)}>
              <Text color={atual === id ? 'claude' : 'inactive'} bold={atual === id} inverse={atual === id}>{` ${nome} `}</Text>
            </Button>
          ))}
        </Box>
      </Box>
    )
    const corta = (t: string, n: number) => (t.length > n ? t.slice(0, Math.max(1, n - 1)) + '…' : t)
    const limpa = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

    if (atual === 'skills') {
      const f = await read($, filtro)
      const todas = await read($, skills)
      const g0 = await read($, grupo)
      const grupos = agrupar(todas, f)
      const cols = W >= 76 ? 4 : 2
      const lw = Math.floor((W - (cols - 1)) / cols)
      const escolhido = f ? null : grupos.find(([g]) => g === g0) ?? grupos[0] ?? null
      const lista = f ? grupos.flatMap(([, l]) => l) : escolhido?.[1] ?? []
      const linhasGrade: (typeof grupos)[] = []
      for (let k = 0; k < grupos.length; k += cols) linhasGrade.push(grupos.slice(k, k + cols))
      return (
        <Box flexDirection="column" rowGap={1}>
          {cab}
          <Box flexDirection="column" width={W}>
            <Input key="filtro" placeholder="⌕ search skills by name or description" value={f} onInput={(v: string) => void update($, filtro, () => v)} onSubmit={(v: string) => void update($, filtro, () => v)} />
            <Text color="inactive">{f ? `${lista.length} of ${todas.length} skills` : `${todas.length} skills in ${grupos.length} group${grupos.length === 1 ? '' : 's'} · click a group`}</Text>
          </Box>
          {!f && (
            <Box flexDirection="column">
              {linhasGrade.map((linha, n) => (
                <Box key={`gl:${n}`} columnGap={1}>
                  {linha.map(([g, l]) => {
                    const ativo = escolhido?.[0] === g
                    return (
                      <Box key={`gt:${g}`} flexDirection="column" borderStyle="round" borderColor={ativo ? 'claude' : 'subtle'} paddingX={1} width={lw}>
                        <Button key={`g:${g}`} plain onPress={() => void update($, grupo, () => g)}>
                          <Text color={ativo ? 'claude' : 'suggestion'} bold>{corta(g, lw - 4)}</Text>
                        </Button>
                        <Text color="inactive">{`${l.length} skill${l.length === 1 ? '' : 's'}`}</Text>
                      </Box>
                    )
                  })}
                </Box>
              ))}
            </Box>
          )}
          {lista.length === 0 && <Text color="inactive">Nothing for "{f}". Try the Hunter (3) to find a new skill.</Text>}
          {lista.length > 0 && cartao('suggestion', f ? 'Results' : escolhido?.[0] ?? '', <Text color="inactive">{lista.length}</Text>, (
            <Box flexDirection="column">
              {lista.map(sk => {
                const nome = `/${sk.name}`
                const desc = corta(limpa(sk.description), Math.max(0, W - nome.length - 7))
                return (
                  <Button key={`s:${sk.name}`} plain onPress={() => void $.prompt.fill({ text: `/${sk.name} `, mode: 'replace' })}>
                    <Text><Text color="claude">› </Text><Text bold>{nome}</Text><Text color="inactive">{desc ? `  ${desc}` : ''}</Text></Text>
                  </Button>
                )
              })}
            </Box>
          ), 'lista-skills')}
        </Box>
      )
    }

    if (atual === 'files') {
      const [r0, ab, arv, fd, toc, marcas, cur, bs, rm, fixas] = await Promise.all([
        read($, raiz), read($, abertos), read($, arvore), read($, feed), read($, tocando), read($, git), read($, cursor), read($, busca), read($, ramo), read($, raizes),
      ])
      const agora = await $.clock.now()
      // brilho por 4 s no que acabou de mudar; o arquivo do Claude brilha enquanto ele mexe
      const mudou = new Map(fd.filter(m => agora - m.em < 4000).map(m => [m.caminho, m.tipo] as const))
      const vis = achatar(r0, arv, ab, bs)
      const sel = vis[Math.max(0, vis.findIndex(l => l.caminho === cur))]
      const altura = Math.max(6, (e.props?.scroll?.bodyRows ?? 30) - 18)
      const idx = sel ? vis.indexOf(sel) : 0
      const ini = Math.max(0, Math.min(idx - Math.floor(altura / 2), vis.length - altura))
      const corGit = (d: Delta) => (d.marca === '??' ? 'success' : d.marca.includes('D') ? 'error' : 'warning')
      const linhasArv: LinhaArvore[] = vis.slice(ini, ini + altura).map(l => {
        const d = marcas[l.caminho]
        const item = (arv[pai(l.caminho)] as Item[] | undefined)?.find?.(x => x.nome === l.nome)
        const brilho = toc === l.caminho ? 'claude' : mudou.has(l.caminho) ? (mudou.get(l.caminho) === 'novo' ? 'novo' : 'alterado') : undefined
        const corNome = d ? corGit(d) : l.nome.startsWith('.') ? 'inactive' : undefined
        const esq: Seg[] = [
          // explorer do VS Code: guias de indentação, chevron só em pasta, ícone colorido por tipo de arquivo
          { t: '│ '.repeat(l.nivel), c: 'subtle' },
          l.dir ? { t: l.aberto ? '⌄ ' : '› ', c: 'inactive' } : { t: '  ' },
          ...(l.dir
            ? (N.nerd ? [{ t: `${String.fromCodePoint(l.aberto ? 0xe5fe : 0xe5ff)} `, c: d ? 'warning' : corPasta(l.nome) }] : [])
            : [toc === l.caminho ? { t: '● ', c: 'claude' } : iconeArquivo(l.nome, N.nerd)]),
          // props do Client não aceitam undefined: um campo vazio recusa o pane inteiro (fica em branco)
          { t: l.nome, ...(corNome ? { c: corNome } : {}), ...(brilho ? { brilho } : {}) },
        ]
        const dir: Seg[] = d
          ? [...(d.mais ? [{ t: `+${d.mais} `, c: 'success' }] : []), ...(d.menos ? [{ t: `−${d.menos} `, c: 'error' }] : []), { t: l.dir ? `M:${d.n}` : d.marca, c: corGit(d), b: true }]
          : [{ t: colunaDireita(undefined, item?.mtime ?? 0, l.dir), c: 'inactive' }]
        return { id: l.caminho, esq, dir }
      })
      const migalha = nomeCurto(r0, home).split('/')
      const caminhoDe = (n: number) => { const p = migalha.slice(0, n + 1).join('/'); return p.startsWith('~') ? home + p.slice(1) : p || '/' }
      const sinal = { novo: ['new', 'success'], alterado: ['modified', 'warning'], removido: ['deleted', 'error'] } as const
      // painéis no estilo do Flightdeck: legenda, cartão com título "RÓTULO · detalhe", recibo e log
      const soma = { alt: 0, novo: 0, apag: 0, mais: 0, menos: 0 }
      for (const [c, d] of Object.entries(marcas)) {
        if (d.marca === 'dir' || !c.startsWith(`${r0}/`)) continue
        if (d.marca === '??' || d.marca.includes('A')) soma.novo++
        else if (d.marca.includes('D')) soma.apag++
        else soma.alt++
        soma.mais += d.mais; soma.menos += d.menos
      }
      const sujo = soma.alt + soma.novo + soma.apag
      const corPainel = !rm ? 'subtle' : sujo ? 'warning' : 'success'
      const hora = (ms: number) => new Date(ms).toTimeString().slice(0, 8)
      return (
        <Box flexDirection="column" rowGap={1}>
          {cab}
          <Text wrap="truncate">
            {([['warning', 'modified'], ['success', 'new'], ['error', 'deleted'], ['claude', 'claude editing']] as const).map(([c, rot]) => (
              <Text key={`lg:${rot}`}><Text color={c}>■ </Text><Text color="inactive">{`${rot}  `}</Text></Text>
            ))}
          </Text>
          {cartao(corPainel, `FILES · ${migalha[migalha.length - 1] || '/'}`, rm ? (
            <Text wrap="truncate">
              <Text color="inactive">⑂ </Text><Text bold>{rm.ramo}</Text>
              {rm.frente ? <Text color="success">{` ↑${rm.frente}`}</Text> : null}
              {rm.atras ? <Text color="warning">{` ↓${rm.atras}`}</Text> : null}
              {rm.upstream ? null : <Text color="inactive"> no upstream</Text>}
            </Text>
          ) : <Text color="inactive">no git</Text>, (
            <Box flexDirection="column">
              <Box flexDirection="row">
                {migalha.map((parte, n) => (
                  <Button key={`mg:${n}`} plain onPress={() => void navegar($, 'entrar', caminhoDe(n))}>
                    <Text color={n === migalha.length - 1 ? 'claude' : 'inactive'} bold={n === migalha.length - 1}>{`${parte}${n < migalha.length - 1 ? '/' : ''}`}</Text>
                  </Button>
                ))}
              </Box>
              <Input key="busca-pasta" placeholder="/ : search this folder" value={bs} onInput={(v: string) => void update($, busca, () => v)} onSubmit={(v: string) => void update($, busca, () => v)} />
              <Box columnGap={2}>
                {([['j', '↓'], ['k', '↑'], ['h', '←'], ['l', '→'], ['o', 'open']] as const).map(([k, rot]) => (
                  <Button key={`tk:${k}`} plain hotkey={k} label={rot} onPress={() => void navegar($, k)} />
                ))}
              </Box>
              {vis.length === 0 && <Text color="inactive">{arv[r0] ? (bs ? `nothing for "${bs}"` : 'empty folder') : 'reading…'}</Text>}
              {Client
                ? <Client key="arvore" module="./arvore.tsx" props={{ linhas: linhasArv, ativa: sel?.caminho ?? '', fundoAtivo: '#3a2a24', fundoHover: '#262626' } satisfies ArvoreProps} />
                : linhasArv.map(l => (
                  <Button key={`p:${l.id}`} plain onPress={() => void navegar($, 'clique', l.id)}>
                    <Text wrap="truncate">{l.esq.map((sg, n) => <Text key={`s${n}`} color={sg.c} bold={sg.b}>{sg.t}</Text>)}</Text>
                  </Button>
                ))}
              {vis.length > altura && <Text color="inactive">{`${ini + 1}–${Math.min(vis.length, ini + altura)} of ${vis.length}`}</Text>}
            </Box>
          ), 'painel-pastas')}
          {rm && (
            <Box key="recibo-git" borderStyle="round" borderColor={corPainel} paddingX={1} width={W}>
              <Text wrap="truncate">
                <Text color={sujo ? 'warning' : 'success'}>{sujo ? '● ' : '✓ '}</Text>
                <Text>{sujo ? `${soma.alt} modified · ${soma.novo} new · ${soma.apag} deleted` : 'clean tree'}</Text>
                {soma.mais ? <Text color="success">{` · +${soma.mais}`}</Text> : null}
                {soma.menos ? <Text color="error">{` −${soma.menos}`}</Text> : null}
              </Text>
            </Box>
          )}
          {fd.length > 0 && (
            <Box key="log-pastas" flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} width={W}>
              <Text color="inactive">change log</Text>
              {fd.slice(0, 6).map((m, n) => (
                <Text key={`f:${n}:${m.caminho}`} wrap="truncate">
                  <Text color="inactive">{`${hora(m.em)} `}</Text>
                  <Text color={sinal[m.tipo][1]} bold>{sinal[m.tipo][0].padEnd(9)}</Text>
                  <Text>{nomeCurto(m.caminho, home)}</Text>
                </Text>
              ))}
            </Box>
          )}
          <Box columnGap={2}>
            {fixas.map(f => (
              <Button key={`fx:${f}`} plain onPress={() => void navegar($, 'entrar', f)}><Text color={f === r0 ? 'claude' : 'inactive'}>{`★ ${f.split('/').pop()}`}</Text></Button>
            ))}
            <Button key="fx:add" plain onPress={() => void update($, raizes, l => (l.includes(r0) ? l.filter(x => x !== r0) : [...l, r0]))}>
              <Text color="inactive">{fixas.includes(r0) ? '☆ unpin' : '+ pin this'}</Text>
            </Button>
          </Box>
        </Box>
      )
    }

    if (atual === 'hunter') {
      const hs = await read($, hunter)
      return (
        <Box flexDirection="column" rowGap={1}>
          {cab}
          {cartao('claude', 'Skill hunter', <Text color="inactive">skills.sh · find-skills</Text>, (
            <Box flexDirection="column">
              <Input key="busca" placeholder="⌕ what do you need? (e.g. playwright, sql, pdf)" value={hs.termo} submitLabel="Search" onSubmit={(v: string) => v.trim() && void buscar($, v.trim())} />
              <Text color="inactive" wrap="truncate">{hs.estado || 'Search → Review (downloads only SKILL.md for Claude to read) → Install'}</Text>
            </Box>
          ), 'busca-card')}
          {hs.achados.map(a => {
            const revisado = hs.revisados.includes(a.id)
            const instalado = hs.instalados.includes(a.id)
            const passo = instalado ? <Text color="success">✓ installed</Text> : revisado ? <Text color="warning">◐ reviewed</Text> : <Text color="inactive">○ not reviewed</Text>
            return cartao(instalado ? 'success' : revisado ? 'warning' : 'subtle', a.name, <Text color="inactive">{`★ ${fmtInstalls(a.installs)}`}</Text>, (
              <Box flexDirection="column">
                <Text color="inactive" wrap="truncate">{a.source}</Text>
                <Box justifyContent="space-between">
                  {passo}
                  <Box columnGap={2}>
                    <Button key={`rev:${a.id}`} plain onPress={() => void revisar($, a)}><Text color="suggestion">{revisado ? '↻ review again' : '⌕ review'}</Text></Button>
                    {revisado && !instalado ? <Button key={`ins:${a.id}`} plain onPress={() => void instalar($, a)}><Text color="success" bold>↓ install</Text></Button> : null}
                  </Box>
                </Box>
              </Box>
            ), `h:${a.id}`)
          })}
        </Box>
      )
    }

    {
      const u = await read($, uso)
      const tr = await read($, turnos)
      const dur = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : ms < 3600000 ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : `${Math.floor(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`)
      const sess = (await read($, sessao)) as SessionUsage | null
      const PT_NIVEIS = ['off', 'lite', 'full', 'ultra']
      // o atom só segura a última gravação (e faz o pane redesenhar); o arquivo é a fonte
      const ptCfg = { ...(await lerPonytail($)), ...(await read($, ponytail)) }
      const ptVivo = ((await lerTexto($, `${home}/.claude/.ponytail-active`)) ?? '').trim() || 'off'
      const ptPadrao = PT_NIVEIS.includes(String(ptCfg.defaultMode)) ? String(ptCfg.defaultMode) : 'full'
      const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)))
      const barra = (pct: number, w: number, cor: string) => {
        const cheio = Math.max(pct > 0 ? 1 : 0, Math.min(w, Math.round((pct / 100) * w)))
        return <Text><Text color={pct >= 85 ? 'error' : cor}>{'━'.repeat(cheio)}</Text><Text color="subtle">{'╌'.repeat(w - cheio)}</Text></Text>
      }
      const bw = Math.max(10, Math.min(30, W - 30))
      const ctx = sess?.context
      const cats = (ctx?.breakdown?.categories ?? []).filter(c => c.tokens > 0 && !/free|livre|autocompact/i.test(c.name)).sort((x, y) => y.tokens - x.tokens).slice(0, 5)
      const entradaTotal = u.input + u.cacheRead + u.cacheWrite
      const hit = entradaTotal ? (u.cacheRead / entradaTotal) * 100 : 0
      const blocos = '▁▂▃▄▅▆▇█'
      const maxOut = Math.max(1, ...u.ultimas.map(r => r.output))
      const corEf = (e: string) => (e === 'low' ? 'success' : e === 'medium' ? 'suggestion' : e === 'high' ? 'warning' : e === 'xhigh' || e === 'max' ? 'error' : 'subtle')
      const linha = (rot: string, valor: any, key: string) => <Text key={key} wrap="truncate"><Text>{rot.padEnd(14)}</Text>{valor}</Text>
      // insights: cada um vem de um número observado; nenhum compara com uma versão que não existiu
      const agoraMs = await $.clock.now()
      const cinco = (sess?.rateLimits ?? []).find(l => l.kind === 'five_hour')
      if (cinco && !leitura5h) leitura5h = { em: agoraMs, pct: cinco.percentUsed }
      const ritmo = cinco && leitura5h && agoraMs - leitura5h.em > 10 * 60000 ? (cinco.percentUsed - leitura5h.pct) / ((agoraMs - leitura5h.em) / 3600000) : null
      const medio = (ef: string) => { const v = u.porEsforco[ef]; return v && v.req ? v.output / v.req : null }
      const dicas: [string, string, string][] = []
      if (u.cacheRead) dicas.push(['success', '✓', `cache: ${k(u.cacheRead)} tokens read from cache, billed at ~10% of input (~${k(u.cacheRead * 0.9)} token-equivalents saved)`])
      if (entradaTotal && hit < 70) dicas.push(['warning', '!', `low cache hit rate (${Math.round(hit)}%): switching models or editing CLAUDE.md mid-session resets the cache`])
      if (u.ajustadas) dicas.push(['success', '✓', `router: ${u.ajustadas} of ${u.requisicoes} requests ran at a different effort than your /effort`])
      const ml = medio('low'), mh = medio('high') ?? medio('medium')
      if (ml && mh && mh > ml) dicas.push(['suggestion', '·', `average output: low ${k(ml)}/req vs ${k(mh)}/req at ${medio('high') ? 'high' : 'medium'} (observed, not estimated)`])
      if (ctx?.percent != null && ctx.percent >= 70) dicas.push(['warning', '!', `context at ${Math.round(ctx.percent)}%: a /compact now is cheaper than near the limit`])
      if (sess?.cost && tr.n) dicas.push(['suggestion', '·', `average cost per turn: $${(sess.cost.usd / tr.n).toFixed(2)}`])
      if (ritmo != null && ritmo > 0 && cinco) { const h = (100 - cinco.percentUsed) / ritmo; dicas.push([h < 1 ? 'error' : h < 2 ? 'warning' : 'success', h < 2 ? '!' : '·', `5h window: +${ritmo.toFixed(0)}%/h at this pace · limit in ~${h < 1 ? `${Math.round(h * 60)}min` : `${h.toFixed(1)}h`}`]) }
      if (!dicas.length) dicas.push(['inactive', '·', 'no data yet: insights show up after the first requests'])
      const fmtReset = (iso?: string) => { if (!iso) return ''; const ms = Date.parse(iso) - Date.now(); if (!(ms > 0)) return ''; const h = Math.floor(ms / 3600000); return h >= 24 ? ` ↻${Math.floor(h / 24)}d${h % 24}h` : ` ↻${h}h${Math.floor((ms % 3600000) / 60000)}m` }
      return (
        <Box flexDirection="column" rowGap={1}>
          {cab}
          {cartao('success', 'Session', <Text bold>{sess?.cost ? `$${sess.cost.usd.toFixed(2)}` : '—'}</Text>, (
            <Box columnGap={3}>
              <Box flexDirection="column"><Text color="inactive">tokens</Text><Text bold>{k(u.input + u.output + u.cacheRead + u.cacheWrite)}</Text></Box>
              <Box flexDirection="column"><Text color="inactive">turns</Text><Text bold>{tr.n}</Text></Box>
              <Box flexDirection="column"><Text color="inactive">agent</Text><Text bold>{dur(tr.ms)}</Text></Box>
              <Box flexDirection="column"><Text color="inactive">per turn</Text><Text bold>{tr.n ? dur(tr.ms / tr.n) : '—'}</Text></Box>
              <Box flexDirection="column"><Text color="inactive">cache</Text><Text bold color={hit >= 70 ? 'success' : 'warning'}>{`${Math.round(hit)}%`}</Text></Box>
            </Box>
          ), 'sessao-resumo')}
          {cartao('claude', 'Context', <Text color="inactive">{ctx ? `${k(ctx.tokens ?? 0)} / ${k(ctx.window)}` : 'unavailable'}</Text>, (
            <Box flexDirection="column">
              {ctx && <Text>{barra(ctx.percent ?? 0, bw, 'claude')}<Text bold>{` ${Math.round(ctx.percent ?? 0)}%`}</Text></Text>}
              {cats.map(c => linha(corta(c.name.replace(/\s*\(.*$/, ''), 13), <Text>{barra(ctx ? (c.tokens / ctx.window) * 100 : 0, bw, c.color || 'suggestion')}<Text>{` ${k(c.tokens)}`}</Text></Text>, `cat:${c.name}`))}
            </Box>
          ), 'ctx')}
          {cartao('warning', 'Limits and cost', <Text bold>{sess?.cost ? `$${sess.cost.usd.toFixed(2)}` : '—'}</Text>, (
            <Box flexDirection="column">
              {(sess?.rateLimits ?? []).length === 0 && <Text color="inactive">no limits reported for this account</Text>}
              {(sess?.rateLimits ?? []).map(l => linha(({ five_hour: '5h window', seven_day: 'week', seven_day_opus: 'week opus' } as Record<string, string>)[l.kind] ?? l.kind.replace(/_/g, ' '), <Text>{barra(l.percentUsed, bw, 'warning')}<Text bold>{` ${Math.round(l.percentUsed)}%`}</Text><Text color="inactive">{fmtReset(l.resetsAt)}</Text></Text>, `lim:${l.kind}`))}
            </Box>
          ), 'lim')}
          {cartao('success', 'Savings', <Text color="inactive">measured this session</Text>, (
            <Box flexDirection="column">
              {dicas.map(([cor, sinal, texto], n) => (
                <Text key={`dc:${n}`} wrap="wrap"><Text color={cor} bold>{`${sinal} `}</Text><Text>{texto}</Text></Text>
              ))}
              <Text color="inactive" wrap="wrap">{'ponytail full (benchmark, not this session): ▼45% output tokens · ▼26% cost · ▼41% time'}</Text>
            </Box>
          ), 'economia')}
          {cartao('claude', `PONYTAIL · ${ptVivo}`, <Text color="inactive">{`default ${ptPadrao}`}</Text>, (
            <Box flexDirection="column">
              <Box columnGap={1}>
                <Text>{'now'.padEnd(8)}</Text>
                {PT_NIVEIS.map(v => (
                  <Button key={`ptv:${v}`} plain onPress={() => void $.prompt.fill({ text: `/ponytail ${v}`, mode: 'replace' })}>
                    <Text color={ptVivo === v ? 'claude' : 'inactive'} bold={ptVivo === v} inverse={ptVivo === v}>{` ${v} `}</Text>
                  </Button>
                ))}
              </Box>
              <Box columnGap={1}>
                <Text>{'default'.padEnd(8)}</Text>
                {PT_NIVEIS.map(v => (
                  <Button key={`ptp:${v}`} plain onPress={() => void configPonytail($, { defaultMode: v })}>
                    <Text color={ptPadrao === v ? 'claude' : 'inactive'} bold={ptPadrao === v} inverse={ptPadrao === v}>{` ${v} `}</Text>
                  </Button>
                ))}
              </Box>
              <Box columnGap={2}>
                <Button key="pt:status" plain onPress={() => void configPonytail($, { hideStatus: !ptCfg.hideStatus })}>
                  <Text color={ptCfg.hideStatus ? 'inactive' : 'success'}>{`${ptCfg.hideStatus ? '□' : '■'} status bar`}</Text>
                </Button>
                <Button key="pt:quiet" plain onPress={() => void configPonytail($, { quietStartup: !ptCfg.quietStartup })}>
                  <Text color={ptCfg.quietStartup ? 'inactive' : 'success'}>{`${ptCfg.quietStartup ? '□' : '■'} startup notice`}</Text>
                </Button>
              </Box>
              <Text color="inactive" wrap="wrap">now: fills /ponytail in the prompt · default and boxes: next session</Text>
            </Box>
          ), 'ponytail')}
          {cartao('suggestion', 'Tokens this session', <Text color="inactive">{`${u.requisicoes} req · ${u.ajustadas} adjusted`}</Text>, (
            <Box flexDirection="column">
              {linha('input', <Text bold>{k(u.input)}</Text>, 't1')}
              {linha('output', <Text bold>{k(u.output)}</Text>, 't2')}
              {linha('cache read', <Text><Text bold>{k(u.cacheRead)}</Text><Text color={hit >= 70 ? 'success' : 'warning'}>{`  hit ${Math.round(hit)}%`}</Text></Text>, 't3')}
              {linha('cache write', <Text bold>{k(u.cacheWrite)}</Text>, 't4')}
              {linha('classifier', <Text><Text bold>{`${u.haiku}×`}</Text><Text color="inactive">{` Haiku · ${k(u.haikuTokens)} tokens`}</Text></Text>, 't5')}
            </Box>
          ), 'tok')}
          {cartao('merged', 'By effort', <Text color="inactive">average output per req</Text>, (
            <Box flexDirection="column">
              {Object.keys(u.porEsforco).length === 0 && <Text color="inactive">no requests yet</Text>}
              {Object.entries(u.porEsforco).map(([ef, v]) => linha(ef, <Text><Text color={corEf(ef)} bold>{`${v.req} req`}</Text><Text color="inactive">{`  ${k(v.output / Math.max(1, v.req))} output/req`}</Text></Text>, `pe:${ef}`))}
              {u.ultimas.length > 0 && (
                <Text wrap="truncate">
                  <Text color="inactive">{'recent'.padEnd(14)}</Text>
                  {u.ultimas.map((r, n) => <Text key={`u:${n}`} color={corEf(r.effort)}>{blocos[Math.min(7, Math.floor((r.output / maxOut) * 7.99))]}</Text>)}
                </Text>
              )}
            </Box>
          ), 'pe')}
          {cartao('suggestion', 'Recent requests', <Text color="inactive">{`${tr.ultimos.length}`}</Text>, (
            <Box flexDirection="column">
              {tr.ultimos.length === 0 && <Text color="inactive">no finished turns yet</Text>}
              {tr.ultimos.map((t, n) => (
                <Text key={`ul:${n}`} wrap="truncate">
                  <Text color={corEf(t.esforco)} bold>{`${t.esforco.padEnd(6)} `}</Text>
                  <Text color="inactive">{`${dur(t.ms).padStart(7)}  `}</Text>
                  <Text>{corta(t.texto, W - 20)}</Text>
                </Text>
              ))}
            </Box>
          ), 'ultimos')}
        </Box>
      )
    }

  }
}
