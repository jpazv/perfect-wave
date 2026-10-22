# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS in `site/`, served by GitHub Pages. No framework, no build step.

## Users

Developers who already use Claude Code in the terminal (or the desktop app) and install plugins. They want to see what the pane looks like and install it with one command.

## Product Purpose

Perfect Wave is a Claude Code mod that docks one pane beside the chat: a live file tree that follows the session, a browser for every installed skill, a skill hunter that reviews a skill before installing it, and a session dashboard with cost, context and limits. Underneath, an effort router sets the effort of each request and the engine enforces git guardrails. Success: a visitor understands the pane in one look and copies the install command.

## Positioning

Three claims with equal weight:
- **See what Claude does**: the tree reveals the file Claude touches; Status shows measured numbers, nothing estimated unless it says so.
- **Spend less**: the router changes only effort, never the model, so the prompt cache survives.
- **Stay safe**: Hunter reviews a skill's SKILL.md before install; guardrails deny force push and ask before merges, pushes to main and subagents.

Runs entirely inside Claude Code's mod engine: no daemon, no extra process, no network calls except the ones the user triggers in the Hunter.

## Capabilities and Constraints

Commands `/wave`, `/wave <tab>`, `/wave-effort <level>`. Install:
`claude plugin marketplace add jpazv/perfect-wave` then `claude plugin install perfect-wave@perfect-wave --scope user`.
Known limits (README): polling instead of a file watcher; bare `git push` on main not detected; pane placement depends on terminal width (~144 columns for a side pane).

## Brand Commitments

Name "Perfect Wave"; tagline "One pane beside Claude Code. Ride the session instead of chasing it." Logo `docs/media/logo.png` (terracotta wave on dark). Clawd, the Claude Code mascot, appears inside the pane (effort card) and may be shown. English copy.

## Evidence on Hand

Real assets in `docs/media/`: `tour.gif`, `effort.gif`, `files-live.png`, `skills-filter.png`, `hunter.png`, `status.png`, `logo.png`, `social-preview.png`. Numbers allowed: values visible in the screenshots, "44 tests passing", Ponytail benchmark (−45% output tokens, −26% cost, −41% time) labeled as benchmark, not measured. MIT license. No testimonials, users, stars or download counts exist; do not invent them.

## Product Principles

- Show the real pane; screenshots over illustrations.
- Measured, not estimated: every number is labeled with where it comes from.
- One command to install, visible early.
- Honest about limits.
