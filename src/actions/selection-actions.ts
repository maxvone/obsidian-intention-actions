import { setHeadingLevel } from "../markdown-utils";
import { showSubmenu } from "../menu";
import { openExtractFlow } from "../extract";
import type IntentionActionsPlugin from "../main";
import type { IntentionAction, IntentionContext } from "../types";
import { docLines, replaceLines } from "./helpers";

const hasSelection = (ctx: IntentionContext): boolean => ctx.selection !== null;

/** Full lines covered by the selection; a selection ending at ch 0 excludes that line. */
function selectedLineSpan(ctx: IntentionContext): [number, number] {
	const sel = ctx.selection!;
	let last = sel.to.line;
	if (last > sel.from.line && sel.to.ch === 0) last--;
	return [sel.from.line, last];
}

function wrapAction(
	id: string,
	title: string,
	icon: string,
	prefix: string,
	suffix: string
): IntentionAction {
	return {
		id,
		title,
		icon,
		group: "selection",
		isAvailable: hasSelection,
		execute: (ctx) => {
			const sel = ctx.selection!;
			ctx.editor.transaction({
				changes: [{ from: sel.from, to: sel.to, text: prefix + sel.text + suffix }],
			});
		},
	};
}

export function selectionActions(plugin: IntentionActionsPlugin): IntentionAction[] {
	return [
		{
			id: "extract-selection",
			title: "Extract to new note",
			icon: "file-output",
			group: "selection",
			isAvailable: hasSelection,
			execute: (ctx) => {
				const sel = ctx.selection!;
				openExtractFlow(plugin, ctx, sel.text, sel.from, sel.to);
			},
		},
		wrapAction("wrap-wikilink", "Wrap in [[wikilink]]", "link", "[[", "]]"),
		wrapAction("wrap-bold", "Wrap in bold", "bold", "**", "**"),
		wrapAction("wrap-italic", "Wrap in italic", "italic", "*", "*"),
		wrapAction("wrap-code", "Wrap in inline code", "code", "`", "`"),
		{
			id: "convert-to-heading",
			title: "Convert to heading…",
			icon: "heading",
			group: "selection",
			isAvailable: hasSelection,
			execute: (ctx) => {
				const levels = [1, 2, 3, 4, 5, 6].map((lvl) => ({
					title: `Heading ${lvl}`,
					icon: `heading-${lvl}`,
					exec: () => {
						const lines = docLines(ctx.editor);
						const [first, last] = selectedLineSpan(ctx);
						const updated = lines
							.slice(first, last + 1)
							.map((l) => (l.trim() === "" ? l : setHeadingLevel(l, lvl)));
						replaceLines(ctx.editor, lines, first, last + 1, updated);
					},
				}));
				showSubmenu(plugin, ctx, levels, plugin.settings.fuzzyFilter);
			},
		},
		{
			id: "move-to-callout",
			title: "Move to callout",
			icon: "quote",
			group: "selection",
			isAvailable: hasSelection,
			execute: (ctx) => {
				const lines = docLines(ctx.editor);
				const [first, last] = selectedLineSpan(ctx);
				const body = lines.slice(first, last + 1).map((l) => (l ? `> ${l}` : ">"));
				replaceLines(ctx.editor, lines, first, last + 1, ["> [!note]", ...body]);
			},
		},
	];
}
