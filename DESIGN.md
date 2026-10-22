# Design

Visual system of the Perfect Wave site (`site/index.html`). Product truth lives in PRODUCT.md.

## World

The page is the engine's own log: claims arrive as verdict rows, ruled by hairlines, that open into the real pane. Ground and accent come from the logo tile; verdict colors come from the pane itself.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--ground` | `#171311` | page ground (logo tile umber-black) |
| `--ground-2` | `#201a17` | hovered / open log row |
| `--rule` | `#3a302b` | 1px hairlines, image frames |
| `--foam` | `#f1e6d3` | display and body text |
| `--foam-dim` | `#b9ab98` | secondary text |
| `--clay` | `#d97757` | install band field, focus ring, selection |
| `--ink-on-clay` | `#1c1210` | text and buttons on clay |
| `--deny` / `--ask` / `--saved` / `--seen` / `--review` | `#ec6a5e` / `#f2c14e` / `#7fcf86` / `#79b8ff` / `#b9a0ff` | verdict stamps only |

## Type

- Display and body: Bricolage Grotesque (variable, self-hosted in `site/fonts/`), h1 at `wdth 85`, tracking -0.04em.
- JetBrains Mono (self-hosted) only for commands, timestamps, verdicts and table data.

## Components

- **Install band**: clay field, two command rows split by a hairline, dark copy button with an authored SVG icon.
- **Log row**: native `<details name="log">` (one open at a time); grid of time, action, verdict stamp. The stamp is a 1px outlined mono label in its verdict color.
- **Shot**: real screenshot, 12px radius, neutral shadow plus 1px rule ring.

## Motion

One authored moment: verdict stamps reveal in sequence once on load (clip-path plus blur, exponential ease-out). Off under `prefers-reduced-motion`.

## Rules

No colored glow shadows, no cards grid, no eyebrow labels. Commands wrap rather than scroll.
