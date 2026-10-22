import type { ClientModule } from 'claude-code'

// Módulo de desenho da aba Pastas: roda no terminal, anima sozinho e devolve cliques e teclas ao plugin (ui.message).
export type Seg = { t: string; c?: string; b?: boolean; brilho?: 'novo' | 'alterado' | 'claude' }
export type LinhaArvore = { id: string; esq: Seg[]; dir: Seg[] }
export type ArvoreProps = { linhas: LinhaArvore[]; ativa: string; fundoAtivo: string; fundoHover: string }
type Local = { hover: number; fase: number; ref: { parar?: () => void; solta?: () => void } }

const TIQUE_MS = 80
// do apagado ao claro: o brilho é uma faixa que corre pelo nome
const TONS: Record<NonNullable<Seg['brilho']>, string[]> = {
  novo: ['#3f7d4e', '#5fb072', '#8fdca0', '#d6ffe0'],
  alterado: ['#8a6a1f', '#c99a2e', '#f2c45a', '#fff0c2'],
  claude: ['#8a4a35', '#c06a4e', '#e8906e', '#ffd2bf'],
}

function tom(i: number, fase: number, n: number, paleta: string[]): string {
  const faixa = ((fase * 1.4) % (n + 8)) - 4
  const d = Math.abs(i - faixa)
  return paleta[d < 0.8 ? 3 : d < 1.8 ? 2 : d < 2.8 ? 1 : 0] ?? paleta[0]!
}

const Arvore: ClientModule<ArvoreProps, Local> = (props, surface) => {
  const { Box, Text } = surface.elements
  let st = surface.state
  if (st === undefined) {
    st = { hover: -1, fase: 0, ref: {} }
    surface.setState(st)
  }
  // anima só enquanto há algo brilhando: parado não gasta nada
  const vivo = props.linhas.some(l => l.esq.some(s => s.brilho))
  if (vivo && !st.ref.parar) {
    st.ref.parar = surface.every(TIQUE_MS, () => {
      const cur = surface.state
      if (cur) surface.setState({ ...cur, fase: cur.fase + 1 })
    })
  } else if (!vivo && st.ref.parar) {
    st.ref.parar()
    st.ref.parar = undefined
  }
  // como o filetree: guarda o retorno, um ouvinte por desenho
  st.ref.solta = surface.onPointer(e => {
    const cur = surface.state ?? st!
    if (e.type === 'leave' || e.y < 0 || e.y >= props.linhas.length) {
      if (cur.hover !== -1) surface.setState({ ...cur, hover: -1 })
      return
    }
    if (e.type === 'move' && cur.hover !== e.y) surface.setState({ ...cur, hover: e.y })
    const l = props.linhas[e.y]
    if (e.type === 'down' && (e.button ?? 'left') === 'left' && l) surface.post({ press: l.id })
  })
  surface.onKey(e => surface.post({ key: e.key }))

  const pinta = (s: Seg) => {
    if (!s.brilho) return <Text color={s.c} bold={s.b}>{s.t}</Text>
    const chars = [...s.t]
    const paleta = TONS[s.brilho]
    return <Text bold={s.b}>{chars.map((ch, i) => <Text color={tom(i, st!.fase, chars.length, paleta)}>{ch}</Text>)}</Text>
  }
  return (
    <Box flexDirection="column">
      {props.linhas.map((l, i) => (
        <Box flexDirection="row" height={1} overflow="hidden"
          backgroundColor={l.id === props.ativa ? props.fundoAtivo : i === st!.hover ? props.fundoHover : undefined}>
          <Box flexShrink={1} overflow="hidden">{l.esq.map(pinta)}</Box>
          <Box flexGrow={1} />
          {l.dir.map(pinta)}
        </Box>
      ))}
    </Box>
  )
}

export default Arvore
