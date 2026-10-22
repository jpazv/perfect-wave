// Ícone de arquivo como no explorer do VS Code (tema Seti): glifo Nerd Font quando há, senão ● na cor do tipo.
const TIPOS: [RegExp, number, string][] = [
  [/\.(ts|mts|cts)$/, 0xe628, '#519aba'],
  [/\.tsx$/, 0xe7ba, '#519aba'],
  [/\.(js|mjs|cjs)$/, 0xe60c, '#cbcb41'],
  [/\.jsx$/, 0xe625, '#cbcb41'],
  [/\.(json|jsonc)$/, 0xe60b, '#cbcb41'],
  [/\.(md|markdown)$/, 0xf0354, '#519aba'],
  [/\.(py|pyi)$/, 0xe606, '#519aba'],
  [/\.(ya?ml|toml|ini|conf)$/, 0xe6a8, '#a074c4'],
  [/\.(sh|bash|zsh|fish)$/, 0xe795, '#8dc149'],
  [/\.(css|scss)$/, 0xe6b8, '#519aba'],
  [/\.html?$/, 0xe736, '#e37933'],
  [/\.(sql)$/, 0xe706, '#f55385'],
  [/\.(png|jpe?g|gif|webp|svg)$/, 0xf0225, '#a074c4'],
  [/\.(zip|gz|tar|xz)$/, 0xf05c4, '#e37933'],
  [/\.(go)$/, 0xe627, '#519aba'],
  [/\.(rs)$/, 0xe68b, '#e37933'],
  [/\.(swift)$/, 0xe755, '#e37933'],
  [/\.(pdf)$/, 0xeaeb, '#cc3e44'],
  [/\.(csv|txt|log)$/, 0xf09aa, '#8a8a8a'],
  [/^(\.gitignore|\.gitmodules)$/, 0xf02a2, '#41535b'],
  [/^(\.env.*)$/, 0xf0493, '#cbcb41'],
]

export function iconeArquivo(nome: string, nerd: boolean): { t: string; c: string } {
  const n = nome.toLowerCase()
  const [, cp, c] = TIPOS.find(([re]) => re.test(n)) ?? [null, 0xf0214, '#8a8a8a']
  return { t: nerd ? `${String.fromCodePoint(cp)} ` : '● ', c }
}
