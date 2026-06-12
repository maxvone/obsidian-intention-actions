import { MarkdownView, setIcon } from "obsidian";
import type { Editor, TFile } from "obsidian";
import type { Extension } from "@codemirror/state";
import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import { buildContext } from "./context-analyzer";
import type IntentionActionsPlugin from "./main";

const DEBOUNCE_MS = 180;

class LightbulbView {
	private el: HTMLElement;
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private view: EditorView,
		private plugin: IntentionActionsPlugin
	) {
		this.el = view.dom.createDiv({ cls: "intentions-lightbulb" });
		setIcon(this.el, "lightbulb");
		this.el.setAttribute("aria-label", "Intention actions (Alt+Enter)");
		this.el.addEventListener("mousedown", (e) => {
			e.preventDefault();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(plugin.app as any).commands.executeCommandById(
				"intention-actions:open-intention-menu"
			);
		});
		this.hide();
	}

	update(upd: ViewUpdate): void {
		if (!upd.selectionSet && !upd.docChanged && !upd.viewportChanged) return;
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => this.check(), DEBOUNCE_MS);
	}

	private check(): void {
		if (!this.plugin.settings.showLightbulb) {
			this.hide();
			return;
		}
		const { editor, file } = this.resolveObsidianEditor();
		if (!editor || !file) {
			this.hide();
			return;
		}
		const ctx = buildContext(editor, file);
		const actions = this.plugin.registry.getAvailable(ctx, this.plugin.settings);
		if (actions.length > 0) {
			this.position(ctx.cursor.line);
		} else {
			this.hide();
		}
	}

	/** Walk all leaves to find the Obsidian Editor that owns this CM6 view. */
	private resolveObsidianEditor(): { editor: Editor | null; file: TFile | null } {
		let editor: Editor | null = null;
		let file: TFile | null = null;
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (editor) return;
			const v = leaf.view;
			if (!(v instanceof MarkdownView)) return;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if ((v.editor as any).cm === this.view) {
				editor = v.editor;
				file = v.file;
			}
		});
		return { editor, file };
	}

	private position(line: number): void {
		const cmLine = line + 1; // CM6 lines are 1-indexed
		const lineObj = this.view.state.doc.line(
			Math.min(cmLine, this.view.state.doc.lines)
		);
		const coords = this.view.coordsAtPos(lineObj.from, -1);
		if (!coords) {
			this.hide();
			return;
		}
		const editorRect = this.view.dom.getBoundingClientRect();
		const contentRect = this.view.contentDOM.getBoundingClientRect();

		const lineHeight = this.view.defaultLineHeight;
		const top = coords.top - editorRect.top + (lineHeight - 20) / 2;
		// Place just to the left of the content area; clamp so it stays visible.
		const left = Math.max(2, contentRect.left - editorRect.left - 26);

		this.el.style.top = `${top}px`;
		this.el.style.left = `${left}px`;
		this.el.classList.add("is-visible");
	}

	private hide(): void {
		this.el.classList.remove("is-visible");
	}

	destroy(): void {
		if (this.timer) clearTimeout(this.timer);
		this.el.remove();
	}
}

export function lightbulbExtension(plugin: IntentionActionsPlugin): Extension {
	return ViewPlugin.fromClass(
		class {
			private lb: LightbulbView;
			constructor(view: EditorView) {
				this.lb = new LightbulbView(view, plugin);
			}
			update(upd: ViewUpdate) {
				this.lb.update(upd);
			}
			destroy() {
				this.lb.destroy();
			}
		}
	);
}
