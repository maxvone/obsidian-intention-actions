/**
 * Pure markdown helpers — no Obsidian imports, fully unit-testable.
 * All ranges are [start, endExclusive] over line numbers unless noted.
 */

export interface DocState {
	inFrontmatter: boolean;
	inCodeFence: boolean;
	/** Line number of the opening fence, -1 when not in a fence. */
	fenceStart: number;
	fenceLang: string;
}

const FENCE_RE = /^\s*(`{3,}|~{3,})\s*(\S*)/;

/** Scan from the top of the document to determine frontmatter/fence state at `lineNo`. */
export function scanDocState(lines: string[], lineNo: number): DocState {
	let fmEnd = -1;
	if (lines[0] === "---") {
		for (let i = 1; i < lines.length; i++) {
			if (lines[i] === "---" || lines[i] === "...") {
				fmEnd = i;
				break;
			}
		}
	}
	const inFrontmatter = fmEnd >= 0 && lineNo <= fmEnd;

	let inFence = false;
	let fenceStart = -1;
	let fenceLang = "";
	let fenceChar = "";
	const scanFrom = fmEnd >= 0 ? fmEnd + 1 : 0;
	for (let i = scanFrom; i <= lineNo && i < lines.length; i++) {
		const m = FENCE_RE.exec(lines[i]);
		if (!m) continue;
		if (!inFence) {
			inFence = true;
			fenceStart = i;
			fenceLang = m[2] ?? "";
			fenceChar = m[1][0];
		} else if (m[1][0] === fenceChar && !m[2]) {
			// Closing fence: the fence line itself still counts as code.
			if (i !== lineNo) {
				inFence = false;
				fenceStart = -1;
				fenceLang = "";
			}
		}
	}
	return { inFrontmatter, inCodeFence: inFence, fenceStart, fenceLang };
}

export type BaseLineType =
	| "heading"
	| "list-item"
	| "quote"
	| "code"
	| "table"
	| "plain"
	| "empty"
	| "frontmatter";

export function detectLineType(line: string, state: DocState): BaseLineType {
	if (state.inFrontmatter) return "frontmatter";
	if (state.inCodeFence) return "code";
	if (/^#{1,6}\s/.test(line)) return "heading";
	if (parseListItem(line)) return "list-item";
	if (/^\s*>/.test(line)) return "quote";
	if (/^\s*\|/.test(line)) return "table";
	if (line.trim() === "") return "empty";
	return "plain";
}

// ---------------- Headings ----------------

export function headingLevel(line: string): number {
	const m = /^(#{1,6})\s/.exec(line);
	return m ? m[1].length : 0;
}

export function setHeadingLevel(line: string, level: number): string {
	const text = line.replace(/^#{1,6}\s+/, "");
	return "#".repeat(Math.min(6, Math.max(1, level))) + " " + text;
}

export function shiftHeading(line: string, delta: number): string {
	const lvl = headingLevel(line);
	if (lvl === 0) return line;
	return setHeadingLevel(line, Math.min(6, Math.max(1, lvl + delta)));
}

/** Section = heading line + content until next heading of same-or-higher level. */
export function sectionRange(lines: string[], headingLine: number): [number, number] {
	const level = headingLevel(lines[headingLine]);
	let end = headingLine + 1;
	while (end < lines.length) {
		const lvl = headingLevel(lines[end]);
		if (lvl > 0 && lvl <= level) break;
		end++;
	}
	return [headingLine, end];
}

/** Adjacent section of the same level, not crossing a higher-level heading. */
export function findSiblingSection(
	lines: string[],
	headingLine: number,
	dir: 1 | -1
): [number, number] | null {
	const level = headingLevel(lines[headingLine]);
	if (dir === 1) {
		const [, end] = sectionRange(lines, headingLine);
		if (end < lines.length && headingLevel(lines[end]) === level) {
			return sectionRange(lines, end);
		}
		return null;
	}
	for (let i = headingLine - 1; i >= 0; i--) {
		const lvl = headingLevel(lines[i]);
		if (lvl === level) return sectionRange(lines, i);
		if (lvl > 0 && lvl < level) return null;
	}
	return null;
}

// ---------------- Lists ----------------

const LIST_RE = /^(\s*)([-*+]|\d+[.)])(\s+)(\[([ xX])\]\s+)?(.*)$/;

export interface ListInfo {
	indent: string;
	marker: string;
	ordered: boolean;
	checkbox: "none" | " " | "x";
	contentStart: number;
	content: string;
}

export function parseListItem(line: string): ListInfo | null {
	const m = LIST_RE.exec(line);
	if (!m) return null;
	const checkbox: ListInfo["checkbox"] = m[4]
		? m[5].toLowerCase() === "x"
			? "x"
			: " "
		: "none";
	return {
		indent: m[1],
		marker: m[2],
		ordered: /\d/.test(m[2]),
		checkbox,
		contentStart: m[1].length + m[2].length + m[3].length + (m[4]?.length ?? 0),
		content: m[6],
	};
}

export function indentWidth(indent: string): number {
	let w = 0;
	for (const c of indent) w += c === "\t" ? 4 : 1;
	return w;
}

export function convertToCheckbox(line: string): string {
	const li = parseListItem(line);
	if (!li || li.checkbox !== "none") return line;
	return `${li.indent}${li.marker} [ ] ${li.content}`;
}

export function toggleCheckbox(line: string): string {
	const li = parseListItem(line);
	if (!li || li.checkbox === "none") return line;
	const next = li.checkbox === "x" ? " " : "x";
	return `${li.indent}${li.marker} [${next}] ${li.content}`;
}

/** Contiguous run of list lines around `lineNo`. */
export function listBlockRange(lines: string[], lineNo: number): [number, number] {
	let start = lineNo;
	while (start > 0 && parseListItem(lines[start - 1])) start--;
	let end = lineNo + 1;
	while (end < lines.length && parseListItem(lines[end])) end++;
	return [start, end];
}

/** List item plus all its nested children. */
export function listItemRange(lines: string[], lineNo: number): [number, number] {
	const li = parseListItem(lines[lineNo]);
	if (!li) return [lineNo, lineNo + 1];
	const w = indentWidth(li.indent);
	let end = lineNo + 1;
	while (end < lines.length) {
		const next = parseListItem(lines[end]);
		if (!next || indentWidth(next.indent) <= w) break;
		end++;
	}
	return [lineNo, end];
}

/** Adjacent sibling item (same indent), skipping over children; null at block edges. */
export function findSiblingItem(
	lines: string[],
	lineNo: number,
	dir: 1 | -1
): [number, number] | null {
	const li = parseListItem(lines[lineNo]);
	if (!li) return null;
	const w = indentWidth(li.indent);
	if (dir === 1) {
		const [, end] = listItemRange(lines, lineNo);
		const next = end < lines.length ? parseListItem(lines[end]) : null;
		if (next && indentWidth(next.indent) === w) return listItemRange(lines, end);
		return null;
	}
	for (let i = lineNo - 1; i >= 0; i--) {
		const prev = parseListItem(lines[i]);
		if (!prev) return null;
		const pw = indentWidth(prev.indent);
		if (pw === w) return listItemRange(lines, i);
		if (pw < w) return null;
	}
	return null;
}

/** Convert every list line to ordered/bullet markers, renumbering per indent level. */
export function convertListBlock(lines: string[], toOrdered: boolean): string[] {
	const counters = new Map<number, number>();
	return lines.map((line) => {
		const li = parseListItem(line);
		if (!li) return line;
		const w = indentWidth(li.indent);
		for (const k of [...counters.keys()]) if (k > w) counters.delete(k);
		let marker = "-";
		if (toOrdered) {
			const n = (counters.get(w) ?? 0) + 1;
			counters.set(w, n);
			marker = `${n}.`;
		}
		const cb = li.checkbox === "none" ? "" : `[${li.checkbox}] `;
		return `${li.indent}${marker} ${cb}${li.content}`;
	});
}

export function indentListItem(lines: string[], indentStr: string): string[] {
	return lines.map((l) => indentStr + l);
}

export function outdentListItem(lines: string[]): string[] {
	const li = parseListItem(lines[0]);
	if (!li || li.indent.length === 0) return [...lines];
	const n = li.indent.startsWith("\t") ? 1 : Math.min(li.indent.length, 4);
	return lines.map((l) => {
		const ws = /^\s*/.exec(l)![0];
		return l.slice(Math.min(n, ws.length));
	});
}

// ---------------- Links ----------------

export interface LinkMatch {
	type: "wiki" | "md";
	/** Offsets within the line, covering the whole link syntax. */
	start: number;
	end: number;
	target: string;
	alias?: string;
	text?: string;
	embed: boolean;
}

const WIKI_RE = /(!?)\[\[([^\[\]]+)\]\]/g;
const MD_RE = /(!?)\[([^\]]*)\]\(([^)]*)\)/g;

export function linkAtCursor(line: string, ch: number): LinkMatch | null {
	WIKI_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = WIKI_RE.exec(line))) {
		const start = m.index;
		const end = start + m[0].length;
		if (ch >= start && ch <= end) {
			const [target, alias] = splitOnce(m[2], "|");
			return { type: "wiki", start, end, target, alias, embed: m[1] === "!" };
		}
	}
	MD_RE.lastIndex = 0;
	while ((m = MD_RE.exec(line))) {
		const start = m.index;
		const end = start + m[0].length;
		if (ch >= start && ch <= end) {
			return { type: "md", start, end, target: m[3], text: m[2], embed: m[1] === "!" };
		}
	}
	return null;
}

function splitOnce(s: string, sep: string): [string, string | undefined] {
	const i = s.indexOf(sep);
	return i < 0 ? [s, undefined] : [s.slice(0, i), s.slice(i + 1)];
}

export function wikiToMarkdown(link: LinkMatch): string {
	const text = link.alias ?? link.target;
	const hasExt = /\.[a-zA-Z0-9]+$/.test(link.target);
	const url = encodeURI(link.target + (hasExt ? "" : ".md"));
	return `${link.embed ? "!" : ""}[${text}](${url})`;
}

export function markdownToWiki(link: LinkMatch): string {
	let target = link.target;
	try {
		target = decodeURI(target);
	} catch {
		// keep raw target if malformed
	}
	target = target.replace(/\.md$/, "");
	const text = link.text ?? "";
	const alias = text && text !== target ? `|${text}` : "";
	return `${link.embed ? "!" : ""}[[${target}${alias}]]`;
}

// ---------------- Inline code ----------------

export function inlineCodeAt(line: string, ch: number): { start: number; end: number } | null {
	const re = /`[^`]+`/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(line))) {
		const start = m.index;
		const end = start + m[0].length;
		if (ch >= start && ch <= end) return { start, end };
	}
	return null;
}

// ---------------- Frontmatter ----------------

/** Inclusive [openingLine, closingLine] of the YAML block, or null. */
export function frontmatterRange(lines: string[]): [number, number] | null {
	if (lines[0] !== "---") return null;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === "---" || lines[i] === "...") return [0, i];
	}
	return null;
}

// ---------------- Templates ----------------

/** Render extract-note name template; result is sanitized for use as a filename. */
export function renderNameTemplate(
	tpl: string,
	vars: { selection: string; date: string; parent: string }
): string {
	const firstLine = (vars.selection.split("\n")[0] ?? "").trim();
	const out = tpl
		.replace(/\{\{selection\}\}/g, firstLine)
		.replace(/\{\{date\}\}/g, vars.date)
		.replace(/\{\{parent\}\}/g, vars.parent);
	return out.replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/\s+/g, " ").trim();
}
