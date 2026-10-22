<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/logo-dark.svg">
    <img src="docs/media/logo.svg" width="180" alt="Perfect Wave logo">
  </picture>
</p>

<h1 align="center">Perfect Wave</h1>

<p align="center">
  <em>One pane beside Claude Code. Ride the session instead of chasing it.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude%20Code-mod-D97757?style=flat-square" alt="Claude Code mod">
  <img src="https://img.shields.io/badge/tabs-files%20%C2%B7%20skills%20%C2%B7%20hunter%20%C2%B7%20status-111111?style=flat-square" alt="Tabs">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <img src="docs/media/tour.gif" width="520" alt="Perfect Wave tour: files, skills, effort, hunter and status">
</p>

A side pane mod for [Claude Code](https://claude.com/claude-code): a live file tree, every skill you have, a skill hunter with a review step, and a session dashboard. On top of that, an effort router that picks the reasoning effort per request and a few git guardrails enforced by the engine.

## What's inside

| Part | What it does |
|---|---|
| **Files** | Live tree of the session's folder (follows `cd`). Git marks per file and folder (`+/−` lines, `M:n`), branch with ahead/behind, a change log, and the file Claude is editing highlighted while it works. Click a file to insert `@path` in the prompt. Keys `j k h l o`, search with `/`, pin folders. |
| **Skills** | Every skill and command grouped (Firecrawl, Marketing, Design, Documents, Code, Other). Search by name or description; click to fill `/skill` in the prompt. |
| **Hunter** | Searches [skills.sh](https://skills.sh) through its JSON API without running third-party code. **Review** downloads only the `SKILL.md` and asks Claude for a verdict; **Install** only shows up after a review and still asks for confirmation (`npx skills add … -g`, telemetry off). |
| **Status** | Session cost, tokens, turns, cache hit rate, context breakdown, 5h/week limits with reset time and burn rate, measured savings, effort usage, recent requests, and a Ponytail card to switch its level and defaults. |
| **Effort router** | Scores each prompt (risk, code, breadth, length) and sets the effort for that request without ever changing the model, so the prompt cache survives. Plain text and chores go down, heavy tasks go up and get asked for a plan first. A lowered turn that struggles pauses lowering for a few turns. Pick a level by hand in the pane or with `/wave-effort`. |
| **Guardrails** | Through `tool.check`: force push is **denied**; `gh pr merge` and pushes straight to `main`/`master` **ask**; launching a subagent **asks**. |

## Screenshots

<table>
<tr>
<td width="50%"><b>Files</b>: git marks and the file Claude is touching<br><img src="docs/media/files-live2.png" alt="Files tab"></td>
<td width="50%"><b>Skills</b>: search across every skill<br><img src="docs/media/skills-filter.png" alt="Skills tab"></td>
</tr>
<tr>
<td><b>Hunter</b>: search, review, then install<br><img src="docs/media/hunter.png" alt="Hunter tab"></td>
<td><b>Status</b>: cost, context, limits, savings<br><img src="docs/media/status.png" alt="Status tab"></td>
</tr>
</table>

## Effort levels

The card at the top of the pane shows the effort in use, with Clawd acting it out. `auto` lets the router choose per request; clicking a level (or `/wave-effort <level>`) pins it from the next request on.

| Level | Clawd | When the router picks it | Cost |
|---|---|---|---|
| `low` | napping | Plain text work: translate, rewrite, summarize, quick questions, git and card chores | lowest |
| `medium` | standing | Routine code: a small, local change; also runs the steps of a plan you approved | moderate |
| `high` | running | Heavy or risky work: architecture, auth, data, deploy, broad refactors. Asks for a plan first | higher |
| `xhigh` | full speed | Never automatic, only when you pin it | high |
| `max` | taking off | Never automatic, only when you pin it | highest |

How `auto` decides:

1. Each prompt gets a score from risk words, code words, files named, scope and length.
2. When the score is ambiguous and risk-free, a tiny Haiku call (5 tokens, no history) breaks the tie.
3. A bare approval ("ok", "go") inherits the last decision instead of being scored.
4. Only `effort` changes, never the model, so the prompt cache stays warm.
5. If a lowered turn struggles (many steps or tool errors), lowering pauses for 3 turns.

`inherit` keeps your own `/effort`; `off` turns the router off.

## Install

```bash
claude plugin marketplace add jpazv/perfect-wave
claude plugin install perfect-wave@perfect-wave --scope user
```

The pane opens on its own beside the chat when the terminal is wide enough (about 144 columns); otherwise open it with `/wave`.

## Commands

```text
/wave [files|skills|hunter|status]   open the pane on a tab
/wave skills <filter>                open Skills filtered
/wave hunter <term>                  search skills.sh right away
/wave-effort [auto|low|medium|high|xhigh|max|inherit|off|status]
```

Inside the pane, `1`–`4` switch tabs.

## Develop

```bash
git clone https://github.com/jpazv/perfect-wave
claude --plugin-dir ./perfect-wave/plugin      # try it without installing
claude plugin validate ./perfect-wave/plugin
claude plugin test ./perfect-wave/plugin
```

## Known limits

- The engine has no file watcher: the Files tab polls only the open folders every 2 s.
- `git push` with no destination while on `main` is not detected (only explicit destinations).
- The Ponytail card reads and writes `~/.config/ponytail/config.json`; without Ponytail installed it simply shows the defaults.

## License

MIT
