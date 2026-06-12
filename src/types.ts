import type { Editor, EditorPosition, Plugin, TFile } from "obsidian";
import type { LinkMatch } from "./markdown-utils";

export type LineType =
	| "heading"
	| "list-item"
	| "quote"
	| "code"
	| "table"
	| "link"
	| "plain"
	| "empty"
	| "frontmatter";

export type ActionGroup =
	| "selection"
	| "heading"
	| "list"
	| "link"
	| "code"
	| "text"
	| "frontmatter";

export interface EditorSelectionRange {
	from: EditorPosition;
	to: EditorPosition;
	text: string;
}

export interface IntentionContext {
	editor: Editor;
	file: TFile;
	/** Primary selection only; null when nothing is selected (spec: multicursor unsupported). */
	selection: EditorSelectionRange | null;
	cursor: EditorPosition;
	line: string;
	lineType: LineType;
	/** Link under cursor, if any (works inside lists/headings too). */
	link: LinkMatch | null;
	/** Opening fence line when cursor is inside a fenced code block. */
	fenceStart: number;
	fenceLang: string;
	/** Inline code span under cursor (offsets within `line`). */
	inlineCode: { start: number; end: number } | null;
}

export interface IntentionAction {
	id: string;
	title: string;
	icon?: string;
	group: ActionGroup;
	isAvailable(ctx: IntentionContext): boolean;
	execute(ctx: IntentionContext, plugin: Plugin): void | Promise<void>;
}
