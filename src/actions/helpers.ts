import type { Editor } from "obsidian";

export function docLines(editor: Editor): string[] {
	return editor.getValue().split("\n");
}

/** Replace the inclusive line range [start, endExclusive) with `newLines` in one undo step. */
export function replaceLines(
	editor: Editor,
	lines: string[],
	start: number,
	endExclusive: number,
	newLines: string[]
): void {
	editor.transaction({
		changes: [
			{
				from: { line: start, ch: 0 },
				to: { line: endExclusive - 1, ch: lines[endExclusive - 1].length },
				text: newLines.join("\n"),
			},
		],
	});
}

/**
 * Swap two adjacent line ranges (a before b, a.end === b.start) atomically.
 * Returns the new start line of the range that was `b`.
 */
export function swapLineRanges(
	editor: Editor,
	lines: string[],
	a: [number, number],
	b: [number, number]
): number {
	const swapped = [...lines.slice(b[0], b[1]), ...lines.slice(a[0], a[1])];
	replaceLines(editor, lines, a[0], b[1], swapped);
	return a[0];
}
