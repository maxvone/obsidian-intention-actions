import { frontmatterRange } from "../markdown-utils";
import { PropertyModal } from "../modals";
import type IntentionActionsPlugin from "../main";
import type { IntentionAction, IntentionContext } from "../types";
import { docLines, replaceLines } from "./helpers";

const TAG_RE = /(^|[\s])(#[\w/-]+)/g;

/** Inline #tag under the cursor in a body line. */
function tagAtCursor(line: string, ch: number): { start: number; end: number; tag: string } | null {
	TAG_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = TAG_RE.exec(line))) {
		const start = m.index + m[1].length;
		const end = start + m[2].length;
		if (ch >= start && ch <= end) return { start, end, tag: m[2].slice(1) };
	}
	return null;
}

function parseValue(raw: string): unknown {
	if (raw === "true") return true;
	if (raw === "false") return false;
	if (raw !== "" && !Number.isNaN(Number(raw))) return Number(raw);
	return raw;
}

/** Parse `tags:` property starting at lineNo; supports inline and block list forms. */
function parseTagsProperty(
	lines: string[],
	lineNo: number,
	fmEnd: number
): { tags: string[]; endLine: number } | null {
	const m = /^tags?\s*:\s*(.*)$/.exec(lines[lineNo]);
	if (!m) return null;
	const inline = m[1].trim();
	if (inline) {
		const tags = inline
			.replace(/^\[|\]$/g, "")
			.split(",")
			.map((t) => t.trim().replace(/^["']|["']$/g, ""))
			.filter(Boolean);
		return { tags, endLine: lineNo };
	}
	const tags: string[] = [];
	let end = lineNo;
	for (let i = lineNo + 1; i < fmEnd; i++) {
		const item = /^\s*-\s+(.+)$/.exec(lines[i]);
		if (!item) break;
		tags.push(item[1].trim().replace(/^["']|["']$/g, ""));
		end = i;
	}
	return tags.length ? { tags, endLine: end } : null;
}

export function frontmatterActions(plugin: IntentionActionsPlugin): IntentionAction[] {
	return [
		{
			id: "fm-add-property",
			title: "Add property",
			icon: "plus-circle",
			group: "frontmatter",
			isAvailable: (ctx) => ctx.lineType === "frontmatter",
			execute: (ctx) => {
				new PropertyModal(plugin.app, async (name, value) => {
					await plugin.app.fileManager.processFrontMatter(ctx.file, (fm) => {
						fm[name] = parseValue(value);
					});
				}).open();
			},
		},
		{
			id: "tag-to-frontmatter",
			title: "Move tag to frontmatter",
			icon: "tag",
			group: "frontmatter",
			isAvailable: (ctx) =>
				(ctx.lineType === "plain" || ctx.lineType === "link" || ctx.lineType === "list-item") &&
				tagAtCursor(ctx.line, ctx.cursor.ch) !== null,
			execute: async (ctx) => {
				const found = tagAtCursor(ctx.line, ctx.cursor.ch)!;
				// Remove the inline tag (with one preceding space, if any) first…
				const start = found.start > 0 && ctx.line[found.start - 1] === " "
					? found.start - 1
					: found.start;
				ctx.editor.transaction({
					changes: [
						{
							from: { line: ctx.cursor.line, ch: start },
							to: { line: ctx.cursor.line, ch: found.end },
							text: "",
						},
					],
				});
				// …then add it to frontmatter tags (creates the block when missing).
				await plugin.app.fileManager.processFrontMatter(ctx.file, (fm) => {
					const tags: string[] = Array.isArray(fm.tags)
						? fm.tags
						: fm.tags
							? [String(fm.tags)]
							: [];
					if (!tags.includes(found.tag)) tags.push(found.tag);
					fm.tags = tags;
				});
			},
		},
		{
			id: "fm-tags-to-inline",
			title: "Convert frontmatter tags to inline",
			icon: "tags",
			group: "frontmatter",
			isAvailable: (ctx) => {
				if (ctx.lineType !== "frontmatter") return false;
				const lines = docLines(ctx.editor);
				const fm = frontmatterRange(lines);
				if (!fm) return false;
				return parseTagsProperty(lines, ctx.cursor.line, fm[1]) !== null;
			},
			execute: (ctx) => {
				const lines = docLines(ctx.editor);
				const fm = frontmatterRange(lines)!;
				const parsed = parseTagsProperty(lines, ctx.cursor.line, fm[1])!;
				const inline = parsed.tags.map((t) => `#${t}`).join(" ");
				// One transaction: drop the tags property, insert inline tags after the
				// block (anchored to the end of the closing "---" so it works at EOF too).
				ctx.editor.transaction({
					changes: [
						{
							from: { line: ctx.cursor.line, ch: 0 },
							to: { line: parsed.endLine + 1, ch: 0 },
							text: "",
						},
						{
							from: { line: fm[1], ch: lines[fm[1]].length },
							to: { line: fm[1], ch: lines[fm[1]].length },
							text: "\n" + inline,
						},
					],
				});
			},
		},
	];
}
