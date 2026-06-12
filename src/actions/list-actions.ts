import {
	convertListBlock,
	convertToCheckbox,
	findSiblingItem,
	indentListItem,
	listBlockRange,
	listItemRange,
	outdentListItem,
	parseListItem,
	toggleCheckbox,
} from "../markdown-utils";
import { openExtractFlow } from "../extract";
import type IntentionActionsPlugin from "../main";
import type { IntentionAction, IntentionContext } from "../types";
import { docLines, replaceLines, swapLineRanges } from "./helpers";

const onList = (ctx: IntentionContext): boolean => ctx.lineType === "list-item";
const item = (ctx: IntentionContext) => parseListItem(ctx.line);

export function listActions(plugin: IntentionActionsPlugin): IntentionAction[] {
	return [
		{
			id: "list-to-checkbox",
			title: "Convert to checkbox",
			icon: "check-square",
			group: "list",
			isAvailable: (ctx) => onList(ctx) && item(ctx)?.checkbox === "none",
			execute: (ctx) => ctx.editor.setLine(ctx.cursor.line, convertToCheckbox(ctx.line)),
		},
		{
			id: "list-toggle-checkbox",
			title: "Toggle checkbox state",
			icon: "check-check",
			group: "list",
			isAvailable: (ctx) => onList(ctx) && item(ctx)?.checkbox !== "none" && item(ctx) !== null,
			execute: (ctx) => ctx.editor.setLine(ctx.cursor.line, toggleCheckbox(ctx.line)),
		},
		{
			id: "list-to-numbered",
			title: "Convert list to numbered",
			icon: "list-ordered",
			group: "list",
			isAvailable: (ctx) => onList(ctx) && item(ctx)?.ordered === false,
			execute: (ctx) => convertBlock(ctx, true),
		},
		{
			id: "list-to-bullet",
			title: "Convert list to bullets",
			icon: "list",
			group: "list",
			isAvailable: (ctx) => onList(ctx) && item(ctx)?.ordered === true,
			execute: (ctx) => convertBlock(ctx, false),
		},
		{
			id: "list-move-up",
			title: "Move list item up",
			icon: "arrow-up",
			group: "list",
			isAvailable: (ctx) =>
				onList(ctx) && findSiblingItem(docLines(ctx.editor), ctx.cursor.line, -1) !== null,
			execute: (ctx) => moveItem(ctx, -1),
		},
		{
			id: "list-move-down",
			title: "Move list item down",
			icon: "arrow-down",
			group: "list",
			isAvailable: (ctx) =>
				onList(ctx) && findSiblingItem(docLines(ctx.editor), ctx.cursor.line, 1) !== null,
			execute: (ctx) => moveItem(ctx, 1),
		},
		{
			id: "list-indent",
			title: "Indent list item",
			icon: "indent-increase",
			group: "list",
			isAvailable: (ctx) =>
				onList(ctx) && findSiblingItem(docLines(ctx.editor), ctx.cursor.line, -1) !== null,
			execute: (ctx) => {
				const lines = docLines(ctx.editor);
				const [start, end] = listItemRange(lines, ctx.cursor.line);
				replaceLines(ctx.editor, lines, start, end, indentListItem(lines.slice(start, end), "\t"));
			},
		},
		{
			id: "list-outdent",
			title: "Outdent list item",
			icon: "indent-decrease",
			group: "list",
			isAvailable: (ctx) => onList(ctx) && (item(ctx)?.indent.length ?? 0) > 0,
			execute: (ctx) => {
				const lines = docLines(ctx.editor);
				const [start, end] = listItemRange(lines, ctx.cursor.line);
				replaceLines(ctx.editor, lines, start, end, outdentListItem(lines.slice(start, end)));
			},
		},
		{
			id: "list-extract-sublist",
			title: "Extract sublist to new note",
			icon: "file-output",
			group: "list",
			isAvailable: (ctx) => {
				if (!onList(ctx)) return false;
				const lines = docLines(ctx.editor);
				const [start, end] = listItemRange(lines, ctx.cursor.line);
				return end > start + 1; // has nested children
			},
			execute: (ctx) => {
				const lines = docLines(ctx.editor);
				const [start, end] = listItemRange(lines, ctx.cursor.line);
				const text = outdentListItem(lines.slice(start, end)).join("\n");
				openExtractFlow(
					plugin,
					ctx,
					text,
					{ line: start, ch: 0 },
					{ line: end - 1, ch: lines[end - 1].length }
				);
			},
		},
	];
}

function convertBlock(ctx: IntentionContext, toOrdered: boolean): void {
	const lines = docLines(ctx.editor);
	const [start, end] = listBlockRange(lines, ctx.cursor.line);
	replaceLines(ctx.editor, lines, start, end, convertListBlock(lines.slice(start, end), toOrdered));
}

function moveItem(ctx: IntentionContext, dir: 1 | -1): void {
	const lines = docLines(ctx.editor);
	const current = listItemRange(lines, ctx.cursor.line);
	const sibling = findSiblingItem(lines, ctx.cursor.line, dir)!;
	if (dir === -1) {
		const newStart = swapLineRanges(ctx.editor, lines, sibling, current);
		ctx.editor.setCursor({ line: newStart + (ctx.cursor.line - current[0]), ch: ctx.cursor.ch });
	} else {
		swapLineRanges(ctx.editor, lines, current, sibling);
		ctx.editor.setCursor({
			line: current[0] + (sibling[1] - sibling[0]) + (ctx.cursor.line - current[0]),
			ch: ctx.cursor.ch,
		});
	}
}
