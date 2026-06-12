import { formatNow } from "../moment-shim";
import { showSubmenu } from "../menu";
import type IntentionActionsPlugin from "../main";
import type { IntentionAction, IntentionContext } from "../types";
import { docLines, replaceLines } from "./helpers";

const onText = (ctx: IntentionContext): boolean =>
	ctx.selection === null && (ctx.lineType === "plain" || ctx.lineType === "empty");
const onParagraph = (ctx: IntentionContext): boolean =>
	ctx.selection === null && ctx.lineType === "plain";

/** Contiguous non-empty lines around the cursor. */
function paragraphRange(lines: string[], lineNo: number): [number, number] {
	let start = lineNo;
	while (start > 0 && lines[start - 1].trim() !== "") start--;
	let end = lineNo + 1;
	while (end < lines.length && lines[end].trim() !== "") end++;
	return [start, end];
}

function insertAtCursor(ctx: IntentionContext, text: string): void {
	ctx.editor.replaceRange(text, ctx.cursor);
	ctx.editor.setCursor({ line: ctx.cursor.line, ch: ctx.cursor.ch + text.length });
}

export function textActions(plugin: IntentionActionsPlugin): IntentionAction[] {
	return [
		{
			id: "insert-snippet",
			title: "Insert template snippet…",
			icon: "scissors",
			group: "text",
			isAvailable: (ctx) =>
				onText(ctx) && plugin.settings.snippets.some((s) => s.name && s.content),
			execute: (ctx) => {
				const items = plugin.settings.snippets
					.filter((s) => s.name && s.content)
					.map((s) => ({
						title: s.name,
						icon: "scissors",
						exec: () => insertAtCursor(ctx, s.content),
					}));
				showSubmenu(plugin, ctx, items, plugin.settings.fuzzyFilter);
			},
		},
		{
			id: "insert-date",
			title: "Insert current date",
			icon: "calendar",
			group: "text",
			isAvailable: onText,
			execute: (ctx) => insertAtCursor(ctx, formatNow(plugin.settings.dateFormat)),
		},
		{
			id: "insert-time",
			title: "Insert current time",
			icon: "clock",
			group: "text",
			isAvailable: onText,
			execute: (ctx) => insertAtCursor(ctx, formatNow(plugin.settings.timeFormat)),
		},
		{
			id: "paragraph-to-quote",
			title: "Convert paragraph to quote",
			icon: "quote",
			group: "text",
			isAvailable: onParagraph,
			execute: (ctx) => {
				const lines = docLines(ctx.editor);
				const [start, end] = paragraphRange(lines, ctx.cursor.line);
				const quoted = lines.slice(start, end).map((l) => `> ${l}`);
				replaceLines(ctx.editor, lines, start, end, quoted);
			},
		},
		{
			id: "paragraph-to-callout",
			title: "Convert paragraph to callout",
			icon: "alert-circle",
			group: "text",
			isAvailable: onParagraph,
			execute: (ctx) => {
				const lines = docLines(ctx.editor);
				const [start, end] = paragraphRange(lines, ctx.cursor.line);
				const body = lines.slice(start, end).map((l) => `> ${l}`);
				replaceLines(ctx.editor, lines, start, end, ["> [!note]", ...body]);
			},
		},
	];
}
