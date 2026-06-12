import { Notice, Plugin } from "obsidian";
import { buildContext } from "./context-analyzer";
import { lightbulbExtension } from "./lightbulb";
import { ActionMenu, cursorCoords } from "./menu";
import { ActionRegistry } from "./registry";
import {
	DEFAULT_SETTINGS,
	IntentionsSettings,
	IntentionsSettingTab,
} from "./settings";
import { codeActions } from "./actions/code-actions";
import { frontmatterActions } from "./actions/frontmatter-actions";
import { headingActions } from "./actions/heading-actions";
import { linkActions } from "./actions/link-actions";
import { listActions } from "./actions/list-actions";
import { selectionActions } from "./actions/selection-actions";
import { textActions } from "./actions/text-actions";
import type { IntentionAction } from "./types";

export default class IntentionActionsPlugin extends Plugin {
	settings!: IntentionsSettings;
	registry = new ActionRegistry();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registry.register(
			...selectionActions(this),
			...headingActions(this),
			...listActions(this),
			...linkActions(this),
			...codeActions(this),
			...textActions(this),
			...frontmatterActions(this)
		);

		this.addSettingTab(new IntentionsSettingTab(this.app, this));

		// CM6 extension — gated by settings at runtime inside LightbulbView.check().
		// A single registerEditorExtension call covers all open editors.
		this.registerEditorExtension(lightbulbExtension(this));

		this.addCommand({
			id: "open-intention-menu",
			name: "Open intention actions menu",
			hotkeys: [{ modifiers: ["Alt"], key: "Enter" }],
			editorCallback: (editor, view) => {
				const file = view.file;
				if (!file) return;
				const ctx = buildContext(editor, file);
				const actions = this.registry.getAvailable(ctx, this.settings);
				if (actions.length === 0) {
					new Notice("No intention actions available");
					return;
				}
				new ActionMenu(this, ctx, actions, cursorCoords(editor), this.settings.fuzzyFilter).open();
			},
		});
	}

	/**
	 * Public API (roadmap v4): other plugins may register custom intention actions.
	 * Returns an unregister function.
	 */
	registerIntentionAction(action: IntentionAction): () => void {
		return this.registry.registerExternal(action);
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<IntentionsSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		this.settings.groups = Object.assign({}, DEFAULT_SETTINGS.groups, data?.groups);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
