import { describe, expect, it } from "vitest";
import {
	convertListBlock,
	convertToCheckbox,
	detectLineType,
	findSiblingItem,
	findSiblingSection,
	frontmatterRange,
	headingLevel,
	indentListItem,
	inlineCodeAt,
	linkAtCursor,
	listBlockRange,
	listItemRange,
	markdownToWiki,
	outdentListItem,
	parseListItem,
	renderNameTemplate,
	scanDocState,
	sectionRange,
	setHeadingLevel,
	shiftHeading,
	toggleCheckbox,
	wikiToMarkdown,
} from "../src/markdown-utils";

describe("detectLineType + scanDocState", () => {
	const doc = [
		"---", // 0
		"title: Test", // 1
		"---", // 2
		"# Heading", // 3
		"", // 4
		"- item", // 5
		"> quote", // 6
		"| a | b |", // 7
		"```js", // 8
		"const x = 1;", // 9
		"```", // 10
		"plain text", // 11
	];
	it("detects frontmatter", () => {
		expect(detectLineType(doc[1], scanDocState(doc, 1))).toBe("frontmatter");
		expect(detectLineType(doc[0], scanDocState(doc, 0))).toBe("frontmatter");
	});
	it("detects heading, empty, list, quote, table", () => {
		expect(detectLineType(doc[3], scanDocState(doc, 3))).toBe("heading");
		expect(detectLineType(doc[4], scanDocState(doc, 4))).toBe("empty");
		expect(detectLineType(doc[5], scanDocState(doc, 5))).toBe("list-item");
		expect(detectLineType(doc[6], scanDocState(doc, 6))).toBe("quote");
		expect(detectLineType(doc[7], scanDocState(doc, 7))).toBe("table");
	});
	it("detects code inside fence including fence lines", () => {
		expect(detectLineType(doc[8], scanDocState(doc, 8))).toBe("code");
		expect(detectLineType(doc[9], scanDocState(doc, 9))).toBe("code");
		expect(detectLineType(doc[10], scanDocState(doc, 10))).toBe("code");
		expect(detectLineType(doc[11], scanDocState(doc, 11))).toBe("plain");
	});
	it("reports fence start line and language", () => {
		const st = scanDocState(doc, 9);
		expect(st.inCodeFence).toBe(true);
		expect(st.fenceStart).toBe(8);
		expect(st.fenceLang).toBe("js");
	});
	it("no frontmatter when doc does not start with ---", () => {
		const d = ["text", "---", "x: 1", "---"];
		expect(detectLineType(d[2], scanDocState(d, 2))).toBe("plain");
	});
});

describe("headings", () => {
	it("headingLevel", () => {
		expect(headingLevel("## Two")).toBe(2);
		expect(headingLevel("plain")).toBe(0);
		expect(headingLevel("#nospace")).toBe(0);
	});
	it("setHeadingLevel converts plain and heading", () => {
		expect(setHeadingLevel("text", 3)).toBe("### text");
		expect(setHeadingLevel("## text", 1)).toBe("# text");
	});
	it("shiftHeading clamps 1..6", () => {
		expect(shiftHeading("# A", 1)).toBe("## A");
		expect(shiftHeading("# A", -1)).toBe("# A");
		expect(shiftHeading("###### A", 1)).toBe("###### A");
	});
});

describe("sectionRange / findSiblingSection", () => {
	const doc = [
		"# Top", // 0
		"intro", // 1
		"## A", // 2
		"a-body", // 3
		"### A1", // 4
		"a1-body", // 5
		"## B", // 6
		"b-body", // 7
		"# Next", // 8
	];
	it("section spans until same-or-higher heading", () => {
		expect(sectionRange(doc, 2)).toEqual([2, 6]);
		expect(sectionRange(doc, 4)).toEqual([4, 6]);
		expect(sectionRange(doc, 0)).toEqual([0, 8]);
		expect(sectionRange(doc, 8)).toEqual([8, 9]);
	});
	it("finds sibling sections of same level", () => {
		expect(findSiblingSection(doc, 2, 1)).toEqual([6, 8]);
		expect(findSiblingSection(doc, 6, -1)).toEqual([2, 6]);
		expect(findSiblingSection(doc, 6, 1)).toBeNull(); // next is higher level
		expect(findSiblingSection(doc, 2, -1)).toBeNull();
	});
});

describe("lists", () => {
	it("parseListItem", () => {
		expect(parseListItem("- item")).toMatchObject({ marker: "-", ordered: false, checkbox: "none" });
		expect(parseListItem("  3. item")).toMatchObject({ ordered: true, indent: "  " });
		expect(parseListItem("- [x] done")).toMatchObject({ checkbox: "x" });
		expect(parseListItem("- [ ] todo")).toMatchObject({ checkbox: " " });
		expect(parseListItem("plain")).toBeNull();
	});
	it("convertToCheckbox / toggleCheckbox", () => {
		expect(convertToCheckbox("- item")).toBe("- [ ] item");
		expect(toggleCheckbox("- [ ] item")).toBe("- [x] item");
		expect(toggleCheckbox("- [x] item")).toBe("- [ ] item");
		expect(toggleCheckbox("1. [ ] item")).toBe("1. [x] item");
	});
	const doc = [
		"text", // 0
		"- a", // 1
		"  - a1", // 2
		"  - a2", // 3
		"- b", // 4
		"- c", // 5
		"", // 6
		"after", // 7
	];
	it("listBlockRange spans contiguous list lines", () => {
		expect(listBlockRange(doc, 4)).toEqual([1, 6]);
	});
	it("listItemRange includes children", () => {
		expect(listItemRange(doc, 1)).toEqual([1, 4]);
		expect(listItemRange(doc, 4)).toEqual([4, 5]);
	});
	it("findSiblingItem skips children", () => {
		expect(findSiblingItem(doc, 1, 1)).toEqual([4, 5]);
		expect(findSiblingItem(doc, 4, -1)).toEqual([1, 4]);
		expect(findSiblingItem(doc, 2, 1)).toEqual([3, 4]);
		expect(findSiblingItem(doc, 1, -1)).toBeNull();
	});
	it("convertListBlock renumbers per indent level", () => {
		const block = ["- a", "  - a1", "- b"];
		expect(convertListBlock(block, true)).toEqual(["1. a", "  1. a1", "2. b"]);
		expect(convertListBlock(["1. x", "2. y"], false)).toEqual(["- x", "- y"]);
	});
	it("indent/outdent move item with children", () => {
		expect(indentListItem(["- a", "  - a1"], "\t")).toEqual(["\t- a", "\t  - a1"]);
		expect(outdentListItem(["  - a", "    - a1"])).toEqual(["- a", "  - a1"]);
		expect(outdentListItem(["- a"])).toEqual(["- a"]);
	});
});

describe("links", () => {
	it("finds wikilink at cursor", () => {
		const line = "see [[Note|alias]] here";
		const m = linkAtCursor(line, 8)!;
		expect(m.type).toBe("wiki");
		expect(m.target).toBe("Note");
		expect(m.alias).toBe("alias");
		expect(line.slice(m.start, m.end)).toBe("[[Note|alias]]");
	});
	it("finds embed wikilink", () => {
		const m = linkAtCursor("![[Img.png]]", 3)!;
		expect(m.embed).toBe(true);
		expect(m.target).toBe("Img.png");
	});
	it("finds markdown link at cursor", () => {
		const line = "go [text](https://x.dev) now";
		const m = linkAtCursor(line, 5)!;
		expect(m.type).toBe("md");
		expect(m.target).toBe("https://x.dev");
		expect(m.text).toBe("text");
	});
	it("returns null when cursor outside link", () => {
		expect(linkAtCursor("see [[Note]] here", 1)).toBeNull();
	});
	it("converts wiki -> md and md -> wiki", () => {
		expect(wikiToMarkdown(linkAtCursor("[[My Note|alias]]", 3)!)).toBe("[alias](My%20Note.md)");
		expect(wikiToMarkdown(linkAtCursor("[[Note]]", 3)!)).toBe("[Note](Note.md)");
		expect(markdownToWiki(linkAtCursor("[alias](My%20Note.md)", 3)!)).toBe("[[My Note|alias]]");
		expect(markdownToWiki(linkAtCursor("[Note](Note.md)", 3)!)).toBe("[[Note]]");
	});
});

describe("inline code", () => {
	it("finds inline code span at cursor", () => {
		const line = "use `foo()` here";
		const s = inlineCodeAt(line, 6)!;
		expect(line.slice(s.start, s.end)).toBe("`foo()`");
	});
	it("null outside span", () => {
		expect(inlineCodeAt("use `foo()` here", 1)).toBeNull();
		expect(inlineCodeAt("no code", 3)).toBeNull();
	});
});

describe("frontmatterRange", () => {
	it("finds range", () => {
		expect(frontmatterRange(["---", "a: 1", "---", "body"])).toEqual([0, 2]);
		expect(frontmatterRange(["body"])).toBeNull();
		expect(frontmatterRange(["---", "a: 1"])).toBeNull();
	});
});

describe("renderNameTemplate", () => {
	it("substitutes variables and sanitizes filename", () => {
		const out = renderNameTemplate("{{selection}} - {{parent}}", {
			selection: "First line: of/selected\ntext",
			date: "2026-06-12",
			parent: "Source",
		});
		expect(out).toBe("First line of selected - Source");
	});
	it("substitutes date", () => {
		expect(
			renderNameTemplate("{{date}}", { selection: "", date: "2026-06-12", parent: "" })
		).toBe("2026-06-12");
	});
});
