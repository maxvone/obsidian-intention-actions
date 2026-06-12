import { moment } from "obsidian";

// obsidian.d.ts types `moment` as the namespace (no call signature); at runtime
// it is the callable moment function bundled with Obsidian.
const momentFn = moment as unknown as () => { format(fmt: string): string };

export function formatNow(fmt: string): string {
	return momentFn().format(fmt);
}
