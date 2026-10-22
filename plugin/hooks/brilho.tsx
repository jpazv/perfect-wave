import type { ClientModule } from 'claude-code'

// Texto que brilha ao nascer: o cartão de esforço monta um novo (key = nível) a cada troca, como o /effort nativo.
export type BrilhoProps = { texto: string; paleta: string[]; negrito?: boolean }
type Local = { fase: number; ref: { parar?: () => void } }

const TIQUE_MS = 60
const FASES = 24 // ~1,5 s e para

export function tomBrilho(i: number, fase: number, paleta: string[]): string {
  const d = Math.abs(i - (fase * 1.2 - 4))
  return paleta[d < 0.8 ? 3 : d < 1.8 ? 2 : d < 2.8 ? 1 : 0] ?? paleta[0]!
}

const Brilho: ClientModule<BrilhoProps, Local> = (props, surface) => {
  const { Box, Text } = surface.elements
  let st = surface.state
  if (st === undefined) {
    st = { fase: 0, ref: {} }
    surface.setState(st)
    st.ref.parar = surface.every(TIQUE_MS, () => {
      const cur = surface.state
      if (!cur) return
      if (cur.fase >= FASES) { cur.ref.parar?.(); cur.ref.parar = undefined; return }
      surface.setState({ ...cur, fase: cur.fase + 1 })
    })
  }
  const fim = st.fase >= FASES
  const chars = [...props.texto]
  return (
    <Box>
      <Text bold={props.negrito}>
      {chars.map((ch, i) => <Text color={fim ? props.paleta[2] : tomBrilho(i, st!.fase, props.paleta)}>{ch}</Text>)}
      </Text>
    </Box>
  )
}

export default Brilho
