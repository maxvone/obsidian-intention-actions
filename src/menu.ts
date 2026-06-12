import { Editor, Notice, Plugin, prepareFuzzySearch, setIcon } from "obsidian";
import type { IntentionAction, IntentionContext } from "./types";

/** Pixel coordinates of the primary cursor, for popup placement. */
export function cursorCoords(editor: Editor): { x: number; y: number } {
	const cm = (editor as unknown as {
		cm?: {
			state: { selection: { main: { head: number } } };
			coordsAtPos(pos: number): { left: number; bottom: number } | null;
		};
	}).cm;
	if (cm) {
		const rect = cm.coordsAtPos(cm.state.selection.main.head);
		if (rect) return { x: rect.left, y: rect.bottom + 4 };
	}
	return { x: window.innerWidth / 2, y: window.innerHeight / 3 };
}

/**
 * Floating action menu at the cursor. Keys are intercepted at document capture
 * level so the editor keeps focus: ↑/↓ select, Enter confirms, Esc closes,
 * printable characters fuzzy-filter the list (when enabled).
 */
export class ActionMenu {
	private el!: HTMLElement;
	private queryEl!: HTMLElement;
	private listEl!: HTMLElement;
	private filtered: IntentionAction[];
	private selected = 0;
	private query = "";

	private onKeydown = (e: KeyboardEvent): void => this.handleKey(e);
	private onClickAway = (e: MouseEvent): void => {
		if (!this.el.contains(e.target as Node)) this.close();
	};

	constructor(
		private plugin: Plugin,
		private ctx: IntentionContext,
		private actions: IntentionAction[],
		private coords: { x: number; y: number },
		private fuzzy: boolean
	) {
		this.filtered = actions;
	}

	open(): void {
		this.el = document.body.createDiv({ cls: "intentions-menu" });
		this.queryEl = this.el.createDiv({ cls: "intentions-menu-query" });
		this.listEl = this.el.createDiv({ cls: "intentions-menu-list" });
		this.render();

		this.el.style.left = `${this.coords.x}px`;
		this.el.style.top = `${this.coords.y}px`;
		const rect = this.el.getBoundingClientRect();
		const pad = 8;
		if (rect.right > window.innerWidth - pad) {
			this.el.style.left = `${Math.max(pad, window.innerWidth - rect.width - pad)}px`;
		}
		if (rect.bottom > window.innerHeight - pad) {
			this.el.style.top = `${Math.max(pad, this.coords.y - rect.height - 28)}px`;
		}

		document.addEventListener("keydown", this.onKeydown, true);
		document.addEventListener("mousedown", this.onClickAway, true);
	}

	close(): void {
		document.removeEventListener("keydown", this.onKeydown, true);
		document.removeEventListener("mousedown", this.onClickAway, true);
		this.el?.remove();
	}

	private handleKey(e: KeyboardEvent): void {
		if (e.key === "Escape") {
			this.consume(e);
			this.close();
		} else if (e.key === "ArrowDown") {
			this.consume(e);
			this.move(1);
		} else if (e.key === "ArrowUp") {
			this.consume(e);
			this.move(-1);
		} else if (e.key === "Enter") {
			this.consume(e);
			const action = this.filtered[this.selected];
			if (action) this.choose(action);
		} else if (this.fuzzy && e.key === "Backspace" && this.query) {
			this.consume(e);
			this.query = this.query.slice(0, -1);
			this.render();
		} else if (
			this.fuzzy &&
			e.key.length === 1 &&
			!e.ctrlKey &&
			!e.metaKey &&
			!e.altKey
		) {
			this.consume(e);
			this.query += e.key;
			this.render();
		}
	}

	private consume(e: KeyboardEvent): void {
		e.preventDefault();
		e.stopPropagation();
	}

	private move(delta: number): void {
		if (this.filtered.length === 0) return;
		this.selected = (this.selected + delta + this.filtered.length) % this.filtered.length;
		this.render();
	}

	private choose(action: IntentionAction): void {
		this.close();
		Promise.resolve(action.execute(this.ctx, this.plugin)).catch((err) => {
			console.error("[intention-actions]", err);
			new Notice(`Action failed: ${err?.message ?? err}`);
		});
	}

	private render(): void {
		if (this.query) {
			const fz = prepareFuzzySearch(this.query);
			this.filtered = this.actions
				.map((a) => ({ a, r: fz(a.title) }))
				.filter((x) => x.r !== null)
				.sort((x, y) => (y.r?.score ?? 0) - (x.r?.score ?? 0))
				.map((x) => x.a);
		} else {
			this.filtered = this.actions;
		}
		if (this.selected >= this.filtered.length) this.selected = 0;

		this.queryEl.setText(this.query);
		this.queryEl.toggleClass("is-hidden", !this.query);

		this.listEl.empty();
		if (this.filtered.length === 0) {
			this.listEl.createDiv({ cls: "intentions-menu-empty", text: "No matching actions" });
			return;
		}
		this.filtered.forEach((action, i) => {
			const item = this.listEl.createDiv({ cls: "intentions-menu-item" });
			item.toggleClass("is-selected", i === this.selected);
			const iconEl = item.createSpan({ cls: "intentions-menu-icon" });
			if (action.icon) setIcon(iconEl, action.icon);
			item.createSpan({ cls: "intentions-menu-title", text: action.title });
			item.addEventListener("mousemove", () => {
				if (this.selected !== i) {
					this.selected = i;
					this.render();
				}
			});
			item.addEventListener("mousedown", (e) => {
				e.preventDefault();
				this.choose(action);
			});
			if (i === this.selected) item.scrollIntoView({ block: "nearest" });
		});
	}
}

/** Open a nested menu with ad-hoc child actions (heading levels, snippets, …). */
export function showSubmenu(
	plugin: Plugin,
	ctx: IntentionContext,
	items: { title: string; icon?: string; exec: () => void | Promise<void> }[],
	fuzzy: boolean
): void {
	const actions: IntentionAction[] = items.map((it, i) => ({
		id: `submenu-${i}`,
		title: it.title,
		icon: it.icon,
		group: "selection",
		isAvailable: () => true,
		execute: () => it.exec(),
	}));
	new ActionMenu(plugin, ctx, actions, cursorCoords(ctx.editor), fuzzy).open();
}
