import { TextPromptModal } from "../modals";
import { openExtractFlow } from "../extract";
import type IntentionActionsPlugin from "../main";
import type { IntentionAction, IntentionContext } from "../types";
import { docLines } from "./helpers";

const FENCE_RE = /^(\s*)(`{3,}|~{3,})\s*(\S*)/;

const inFence = (ctx: IntentionContext): boolean =>
	ctx.lineType === "code" && ctx.fenceStart >= 0;

function fenceEnd(lines: string[], fenceStart: number): number {
	const open = FENCE_RE.exec(lines[fenceStart]);
	const char = open ? open[2][0] : "`";
	for (let i = fenceStart + 1; i < lines.length; i++) {
		const m = FENCE_RE.exec(lines[i]);
		if (m && m[2][0] === char && !m[3]) return i;
	}
	return lines.length - 1;
}

export function codeActions(plugin: IntentionActionsPlugin): IntentionAction[] {
	return [
		{
			id: "code-change-language",
			title: "Change code block language",
			icon: "code-2",
			group: "code",
			isAvailable: inFence,
			execute: (ctx) => {
				new TextPromptModal(
					plugin.app,
					"Change code block language",
					"Language",
					ctx.fenceLang,
					(lang) => {
						const lines = docLines(ctx.editor);
						const m = FENCE_RE.exec(lines[ctx.fenceStart]);
						if (!m) return;
						ctx.editor.setLine(ctx.fenceStart, `${m[1]}${m[2]}${lang}`);
					}
				).open();
			},
		},
		{
			id: "code-extract-block",
			title: "Extract code block to new note",
			icon: "file-output",
			group: "code",
			isAvailable: inFence,
			execute: (ctx) => {
				const lines = docLines(ctx.editor);
				const end = fenceEnd(lines, ctx.fenceStart);
				const text = lines.slice(ctx.fenceStart, end + 1).join("\n");
				openExtractFlow(
					plugin,
					ctx,
					text,
					{ line: ctx.fenceStart, ch: 0 },
					{ line: end, ch: lines[end].length }
				);
			},
		},
	];
}
