# Intention Actions

JetBrains-style **Alt+Enter** intention actions (quick-fixes) for Obsidian markdown files.

Press **Alt+Enter** in the editor and a small popup opens next to the cursor. The list of actions depends on context: cursor position, selection, and the element under the cursor (heading, list, link, code block, frontmatter, …).

## Actions

**Selection**
- Extract to new note (preview modal: file name + folder with autocomplete, link or embed)
- Wrap in `[[wikilink]]`, **bold**, *italic*, `inline code`
- Convert to heading (H1–H6 submenu)
- Move to callout (`> [!note]`)

**Heading**
- Increase / decrease heading level
- Extract section to new note (heading + content until the next same-or-higher heading)
- Move section up / down among same-level siblings

**List**
- Convert to checkbox, toggle checkbox state
- Convert bullet ↔ numbered (whole block, renumbered per nesting level)
- Move list item up / down (with nested children)
- Indent / outdent
- Extract sublist to new note

**Link** (`[[wiki]]` or `[text](url)`)
- Open linked note (external URLs open in browser)
- Convert wikilink ↔ markdown link
- Copy link target

**Code block**
- Change fence language
- Extract code block to new note

**Plain text / empty line**
- Insert template snippet (configure snippets in settings)
- Insert current date / time
- Convert paragraph to quote / callout
- Move inline `#tag` to frontmatter

**Frontmatter**
- Add property
- Convert frontmatter tags to inline tags

## Menu

- `↑`/`↓` select, `Enter` confirm, `Esc` close
- Start typing to fuzzy-filter the list (toggle in settings)
- If no actions are available a notice is shown instead

## Settings

- Enable/disable each action group
- Extract to new note: default folder (empty = same as current file), file name template (`{{selection}}`, `{{date}}`, `{{parent}}`), embed vs. wikilink, copy frontmatter
- Date/time formats (moment.js)
- Template snippets
- Hotkey is rebindable via Settings → Hotkeys (`Intention Actions: Open intention actions menu`)

## Notes

- Multicursor is not supported: only the primary cursor/selection is used.
- All multi-line edits are applied in a single transaction (one undo step).

## Development

```bash
npm install
npm run dev    # watch build
npm run build  # type-check + production bundle
npm test       # unit tests (pure markdown logic)
```

Copy `manifest.json`, `main.js`, `styles.css` into `<vault>/.obsidian/plugins/intention-actions/` and enable the plugin.
