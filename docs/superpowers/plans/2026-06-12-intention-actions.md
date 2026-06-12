# Obsidian Intention Actions Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alt+Enter intention-actions menu for Obsidian (JetBrains-style quick fixes for markdown), per full spec (sections 4.1–4.7 + settings).

**Architecture:** Plugin registers one command (`open-intention-menu`). `ContextAnalyzer` builds `IntentionContext` (line type via regex + fence/frontmatter scan). `ActionRegistry` filters actions by `isAvailable(ctx)` and enabled groups. `ActionMenu` is a custom floating popup positioned at cursor coords (CM6 `coordsAtPos`), with arrow/Enter/Esc navigation and optional fuzzy filter (`prepareFuzzySearch`). Pure markdown transforms live in `markdown-utils.ts` (unit-tested, zero obsidian imports). Destructive edits go through `editor.transaction` for single-step undo.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild, vitest (pure logic only).

---

## File Structure

| File | Responsibility |
|---|---|
| `manifest.json`, `versions.json` | Plugin metadata (id `intention-actions`, minAppVersion 1.4.0) |
| `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `.gitignore` | Build setup; bundle `src/main.ts` → `main.js`, external `obsidian` + CM6 |
| `styles.css` | Menu popup styling |
| `src/types.ts` | `LineType`, `IntentionContext`, `IntentionAction`, `ActionGroup` |
| `src/markdown-utils.ts` | Pure functions: `detectLineType`, link-at-cursor parsing, heading level change, section range, list block detection/conversion, fence scan. **Unit-tested.** |
| `src/context-analyzer.ts` | `buildContext(editor, file)` → `IntentionContext` (primary selection only) |
| `src/registry.ts` | `ActionRegistry`: register, `getAvailable(ctx, settings)` |
| `src/menu.ts` | `ActionMenu`: floating popup, keyboard nav, fuzzy filter, submenu support |
| `src/settings.ts` | `IntentionsSettings`, `DEFAULT_SETTINGS`, `IntentionsSettingTab` |
| `src/modals.ts` | `ExtractModal` (name + folder autocomplete + embed toggle), `TextPromptModal`, `PropertyModal`, `FolderSuggest` |
| `src/extract.ts` | Shared extract-to-note: create file (`vault.create`), optional frontmatter copy, `fileManager.generateMarkdownLink`, replace source text |
| `src/actions/selection-actions.ts` | 4.1: extract, wrap wikilink/bold/italic/code, heading H1–H6 submenu, callout |
| `src/actions/heading-actions.ts` | 4.2: level ±, extract section, move section up/down |
| `src/actions/list-actions.ts` | 4.3: checkbox convert/toggle, bullet↔numbered, move item, indent/outdent, extract sublist |
| `src/actions/link-actions.ts` | 4.4: open, wikilink↔markdown, copy target |
| `src/actions/code-actions.ts` | 4.5: change language, extract code block |
| `src/actions/text-actions.ts` | 4.6: snippet insert, date/time, paragraph→quote/callout |
| `src/actions/frontmatter-actions.ts` | 4.7: add property, tag↔frontmatter |
| `src/main.ts` | Plugin class: settings load, registry wiring, `addCommand` (Alt+Enter default) |
| `tests/markdown-utils.test.ts` | Vitest for all pure transforms |

## Key design decisions

- **Multicursor:** use `editor.listSelections()[0]` only (spec §9).
- **lineType detection order:** frontmatter (inside top `--- … ---` block) → code (fence-state scan from top; also inline-code span check) → heading `/^#{1,6}\s/` → list `/^(\s*)([-*+]|\d+[.)])\s/` → quote `/^\s*>/` → table `/^\s*\|/` → empty → plain.
- **Menu positioning:** `(editor as any).cm.coordsAtPos(offset)`; clamp to viewport; fallback to window center.
- **Submenus** (heading levels, callout types, snippets): action's `execute` opens a second `ActionMenu` with generated child actions — interface from spec stays unchanged.
- **Extract to note:** `ExtractModal` prefilled from name template (`{{selection}}`/`{{date}}`/`{{parent}}` vars); folder defaults per settings ("same folder" = empty setting); collision → append ` 1`, ` 2`…; link inserted as `[[..]]` or `![[..]]` per toggle.
- **Settings:** per-group toggles, extract behavior (folder, name template, embed, copy frontmatter), fuzzy on/off, date/time formats, snippets list, hotkey hint pointing to Obsidian Hotkeys.

---

### Task 1: Scaffold + build pipeline
- [ ] `git init`; write manifest/package/tsconfig/esbuild/.gitignore/styles.css
- [ ] `npm install` (obsidian, esbuild, typescript, vitest, builtin-modules)
- [ ] Minimal `src/main.ts` (empty plugin), `npm run build` passes → commit

### Task 2: Types + markdown-utils (TDD)
- [ ] Write `tests/markdown-utils.test.ts` covering: lineType detection (all types incl. fence/frontmatter scan), heading shift, section range, list block + conversions, link-at-cursor, indent ops
- [ ] Run → fail; implement `src/types.ts`, `src/markdown-utils.ts`; run → pass → commit

### Task 3: Context analyzer + registry + menu + settings
- [ ] `context-analyzer.ts`, `registry.ts`, `menu.ts` (popup, nav, fuzzy via `prepareFuzzySearch`, submenu), `settings.ts`, wire into `main.ts` with command + default hotkey; "Нет доступных действий" Notice when empty
- [ ] Build passes → commit

### Task 4: Modals + extract pipeline
- [ ] `modals.ts` (`FolderSuggest` via `AbstractInputSuggest`, `ExtractModal`, `TextPromptModal`, `PropertyModal`), `extract.ts` (name template render, frontmatter copy, collision-safe create, link generation)
- [ ] Build passes → commit

### Task 5: Action groups 4.1–4.7
- [ ] Implement all seven action files; register in `main.ts` with group filtering; all multi-line edits via `editor.transaction`
- [ ] Build + tests pass → commit

### Task 6: Settings tab + polish
- [ ] Full `IntentionsSettingTab`; styles.css final; README.md
- [ ] `npm run build` + `vitest run` pass → final commit

## Self-review (done)
- Spec coverage: 4.1–4.7 all mapped (Task 5), menu/UI §5 (Task 3), settings §6 (Tasks 3/6), tech details §7 (transaction, generateMarkdownLink, coordsAtPos), resolved questions §9 (primary cursor only; extract modal; no action memory). Roadmap §8 collapsed into one build — user asked for plugin per full spec.
- No placeholders: code specified at implementation time within single session; pure logic test-first.
