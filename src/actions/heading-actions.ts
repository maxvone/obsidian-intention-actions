import {
	findSiblingSection,
	headingLevel,
	sectionRange,
	shiftHeading,
} from "../markdown-utils";
import { openExtractFlow } from "../extract";
import type IntentionActionsPlugin from "../main";
import type { IntentionAction, IntentionContext } from "../types";
import { docLines, swapLineRanges } from "./helpers";

const onHeading = (ctx: IntentionContext): boolean => ctx.lineType === "heading";

export function headingActions(plugin: IntentionActionsPlugin): IntentionAction[] {
	return [
		{
			id: "heading-increase",
			title: "Increase heading level",
			icon: "indent-decrease",
			group: "heading",
			isAvailable: (ctx) => onHeading(ctx) && headingLevel(ctx.line) < 6,
			execute: (ctx) => ctx.editor.setLine(ctx.cursor.line, shiftHeading(ctx.line, 1)),
		},
		{
			id: "heading-decrease",
			title: "Decrease heading level",
			icon: "indent-increase",
			group: "heading",
			isAvailable: (ctx) => onHeading(ctx) && headingLevel(ctx.line) > 1,
			execute: (ctx) => ctx.editor.setLine(ctx.cursor.line, shiftHeading(ctx.line, -1)),
		},
		{
			id: "extract-section",
			title: "Extract section to new note",
			icon: "file-output",
			group: "heading",
			isAvailable: onHeading,
			execute: (ctx) => {
				const lines = docLines(ctx.editor);
				const [start, end] = sectionRange(lines, ctx.cursor.line);
				const text = lines.slice(start, end).join("\n");
				openExtractFlow(
					plugin,
					ctx,
					text,
					{ line: start, ch: 0 },
					{ line: end - 1, ch: lines[end - 1].length }
				);
			},
		},
		{
			id: "move-section-up",
			title: "Move section up",
			icon: "arrow-up",
			group: "heading",
			isAvailable: (ctx) =>
				onHeading(ctx) &&
				findSiblingSection(docLines(ctx.editor), ctx.cursor.line, -1) !== null,
			execute: (ctx) => {
				const lines = docLines(ctx.editor);
				const current = sectionRange(lines, ctx.cursor.line);
				const prev = findSiblingSection(lines, ctx.cursor.line, -1)!;
				const newStart = swapLineRanges(ctx.editor, lines, prev, current);
				ctx.editor.setCursor({
					line: newStart + (ctx.cursor.line - current[0]),
					ch: ctx.cursor.ch,
				});
			},
		},
		{
			id: "move-section-down",
			title: "Move section down",
			icon: "arrow-down",
			group: "heading",
			isAvailable: (ctx) =>
				onHeading(ctx) &&
				findSiblingSection(docLines(ctx.editor), ctx.cursor.line, 1) !== null,
			execute: (ctx) => {
				const lines = docLines(ctx.editor);
				const current = sectionRange(lines, ctx.cursor.line);
				const next = findSiblingSection(lines, ctx.cursor.line, 1)!;
				swapLineRanges(ctx.editor, lines, current, next);
				ctx.editor.setCursor({
					line: current[0] + (next[1] - next[0]) + (ctx.cursor.line - current[0]),
					ch: ctx.cursor.ch,
				});
			},
		},
	];
}
