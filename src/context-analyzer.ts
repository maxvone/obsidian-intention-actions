import type { Editor, TFile } from "obsidian";
import {
	detectLineType,
	inlineCodeAt,
	linkAtCursor,
	scanDocState,
} from "./markdown-utils";
import type { IntentionContext, LineType } from "./types";

/** Build the intention context from the primary cursor/selection (multicursor unsupported). */
export function buildContext(editor: Editor, file: TFile): IntentionContext {
	const primary = editor.listSelections()[0];
	const cursor = primary.head;
	const hasSelection =
		primary.anchor.line !== primary.head.line || primary.anchor.ch !== primary.head.ch;

	let selection: IntentionContext["selection"] = null;
	if (hasSelection) {
		const [from, to] =
			primary.anchor.line < primary.head.line ||
			(primary.anchor.line === primary.head.line && primary.anchor.ch <= primary.head.ch)
				? [primary.anchor, primary.head]
				: [primary.head, primary.anchor];
		selection = { from, to, text: editor.getRange(from, to) };
	}

	const lines = editor.getValue().split("\n");
	const line = lines[cursor.line] ?? "";
	const state = scanDocState(lines, cursor.line);
	const base = detectLineType(line, state);
	const link = state.inCodeFence || state.inFrontmatter ? null : linkAtCursor(line, cursor.ch);
	const inlineCode =
		state.inCodeFence || state.inFrontmatter ? null : inlineCodeAt(line, cursor.ch);
	const lineType: LineType = base === "plain" && link ? "link" : base;

	return {
		editor,
		file,
		selection,
		cursor,
		line,
		lineType,
		link,
		fenceStart: state.fenceStart,
		fenceLang: state.fenceLang,
		inlineCode,
	};
}
