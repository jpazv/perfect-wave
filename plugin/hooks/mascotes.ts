// Clawd (o mascote do Claude Code) em blocos, um por nível de esforço: o corpo é igual, os acessórios contam a intensidade.
// Cada linha: [texto, papel] — 'corpo' pinta na cor do tema claude, 'fx' na cor do nível, 'rastro' apagado.
export type Pedaco = [string, 'corpo' | 'fx' | 'rastro' | 'vazio']
export type Mascote = { nome: string; frase: string; linhas: Pedaco[][] }

const corpo = (t: string): Pedaco => [t, 'corpo']
const fx = (t: string): Pedaco => [t, 'fx']
const rastro = (t: string): Pedaco => [t, 'rastro']
const v = (t: string): Pedaco => [t, 'vazio']

// base: o Clawd do banner do Claude Code (3 linhas); a 4ª linha leva o efeito do nível
export const LARGURA_MASCOTE = 13
export const MASCOTES: Record<string, Mascote> = {
  low: { nome: 'napping', frase: 'short answer, little reasoning', linhas: [
    [v('  '), corpo('▐▛███▜▌'), fx(' z')],
    [v(' '), corpo('▝▜█████▛▘'), fx('z')],
    [v('   '), corpo('▘▘ ▝▝')],
    [v('')],
  ] },
  medium: { nome: 'standing', frase: 'routine: thinks as needed', linhas: [
    [v('  '), corpo('▐▛███▜▌')],
    [v(' '), corpo('▝▜█████▛▘')],
    [v('   '), corpo('▘▘ ▝▝')],
    [v('')],
  ] },
  high: { nome: 'running', frase: 'thinks more before acting', linhas: [
    [v('  '), corpo('▐▛███▜▌')],
    [rastro('≡'), corpo('▝▜█████▛▘')],
    [rastro(' ≡ '), corpo('▘▘ ▝▝')],
    [v('')],
  ] },
  xhigh: { nome: 'full speed', frase: 'long reasoning, more tokens', linhas: [
    [v(' '), fx('*'), corpo('▐▛███▜▌')],
    [rastro('≡'), corpo('▝▜█████▛▘')],
    [rastro('≡≡ '), corpo('▘▘ ▝▝')],
    [v('')],
  ] },
  max: { nome: 'taking off', frase: 'everything it has: costly and slow', linhas: [
    [v(' '), fx('*'), corpo('▐▛███▜▌'), fx('*')],
    [v(' '), corpo('▝▜█████▛▘')],
    [v('   '), corpo('▘▘ ▝▝')],
    [v('  '), fx('▲ ▲ ▲ ▲')],
  ] },
}

export const NIVEL_COR: Record<string, string> = { low: 'success', medium: 'suggestion', high: 'warning', xhigh: 'error', max: 'error' }
export const RANK: Record<string, number> = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 }
export const mascoteDe = (nivel: string) => MASCOTES[nivel] ?? MASCOTES.medium!
