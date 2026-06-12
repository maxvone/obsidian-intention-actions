import { App, PluginSettingTab, Setting } from "obsidian";
import type { ActionGroup } from "./types";
import { FolderSuggest } from "./modals";
import type IntentionActionsPlugin from "./main";

export interface SnippetDef {
	name: string;
	content: string;
}

export interface IntentionsSettings {
	groups: Record<ActionGroup, boolean>;
	/** Empty string = same folder as the current file. */
	extractDefaultFolder: string;
	extractNameTemplate: string;
	extractAsEmbed: boolean;
	extractCopyFrontmatter: boolean;
	fuzzyFilter: boolean;
	showLightbulb: boolean;
	dateFormat: string;
	timeFormat: string;
	snippets: SnippetDef[];
}

export const DEFAULT_SETTINGS: IntentionsSettings = {
	groups: {
		selection: true,
		heading: true,
		list: true,
		link: true,
		code: true,
		text: true,
		frontmatter: true,
	},
	extractDefaultFolder: "",
	extractNameTemplate: "{{selection}}",
	extractAsEmbed: false,
	extractCopyFrontmatter: false,
	fuzzyFilter: true,
	showLightbulb: true,
	dateFormat: "YYYY-MM-DD",
	timeFormat: "HH:mm",
	snippets: [],
};

const GROUP_LABELS: Record<ActionGroup, string> = {
	selection: "Selection actions",
	heading: "Heading actions",
	list: "List actions",
	link: "Link actions",
	code: "Code block actions",
	text: "Plain text actions",
	frontmatter: "Frontmatter actions",
};

export class IntentionsSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: IntentionActionsPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName("Hotkey")
			.setDesc(
				"Default is Alt+Enter. Rebind the \"Intention Actions: Open intention actions menu\" command in Settings → Hotkeys."
			)
			.addButton((btn) =>
				btn.setButtonText("Open hotkey settings").onClick(() => {
					const setting = (this.app as unknown as {
						setting: { openTabById(id: string): { setQuery?(q: string): void } };
					}).setting;
					const tab = setting.openTabById("hotkeys");
					tab?.setQuery?.("Intention actions");
				})
			);

		new Setting(containerEl)
			.setName("Fuzzy filter in menu")
			.setDesc("Type while the menu is open to filter actions.")
			.addToggle((t) =>
				t.setValue(s.fuzzyFilter).onChange(async (v) => {
					s.fuzzyFilter = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Show lightbulb indicator")
			.setDesc("Show a lightbulb to the left of the cursor line when actions are available.")
			.addToggle((t) =>
				t.setValue(s.showLightbulb).onChange(async (v) => {
					s.showLightbulb = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Action groups").setHeading();
		(Object.keys(GROUP_LABELS) as ActionGroup[]).forEach((g) => {
			new Setting(containerEl).setName(GROUP_LABELS[g]).addToggle((t) =>
				t.setValue(s.groups[g]).onChange(async (v) => {
					s.groups[g] = v;
					await this.plugin.saveSettings();
				})
			);
		});

		new Setting(containerEl).setName("Extract to new note").setHeading();
		new Setting(containerEl)
			.setName("Default folder")
			.setDesc("Leave empty to use the folder of the current file.")
			.addText((t) => {
				new FolderSuggest(this.app, t.inputEl);
				t.setPlaceholder("Same as current file")
					.setValue(s.extractDefaultFolder)
					.onChange(async (v) => {
						s.extractDefaultFolder = v.trim();
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("File name template")
			.setDesc("Variables: {{selection}}, {{date}}, {{parent}}.")
			.addText((t) =>
				t.setValue(s.extractNameTemplate).onChange(async (v) => {
					s.extractNameTemplate = v || "{{selection}}";
					await this.plugin.saveSettings();
				})
			);
		new Setting(containerEl)
			.setName("Insert link as embed")
			.setDesc("Replace extracted text with ![[note]] instead of [[note]].")
			.addToggle((t) =>
				t.setValue(s.extractAsEmbed).onChange(async (v) => {
					s.extractAsEmbed = v;
					await this.plugin.saveSettings();
				})
			);
		new Setting(containerEl)
			.setName("Copy frontmatter to new note")
			.setDesc("Carry over the source note's frontmatter (including tags).")
			.addToggle((t) =>
				t.setValue(s.extractCopyFrontmatter).onChange(async (v) => {
					s.extractCopyFrontmatter = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Insert date/time").setHeading();
		new Setting(containerEl)
			.setName("Date format")
			.setDesc("Moment.js format, e.g. YYYY-MM-DD.")
			.addText((t) =>
				t.setValue(s.dateFormat).onChange(async (v) => {
					s.dateFormat = v || "YYYY-MM-DD";
					await this.plugin.saveSettings();
				})
			);
		new Setting(containerEl)
			.setName("Time format")
			.setDesc("Moment.js format, e.g. HH:mm.")
			.addText((t) =>
				t.setValue(s.timeFormat).onChange(async (v) => {
					s.timeFormat = v || "HH:mm";
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Template snippets")
			.setDesc("Snippets offered by \"Insert template snippet\" on plain/empty lines.")
			.setHeading();
		s.snippets.forEach((snippet, i) => {
			new Setting(containerEl)
				.addText((t) =>
					t.setPlaceholder("Name")
						.setValue(snippet.name)
						.onChange(async (v) => {
							snippet.name = v;
							await this.plugin.saveSettings();
						})
				)
				.addTextArea((t) =>
					t.setPlaceholder("Snippet content")
						.setValue(snippet.content)
						.onChange(async (v) => {
							snippet.content = v;
							await this.plugin.saveSettings();
						})
				)
				.addExtraButton((b) =>
					b.setIcon("trash").setTooltip("Delete snippet").onClick(async () => {
						s.snippets.splice(i, 1);
						await this.plugin.saveSettings();
						this.display();
					})
				);
		});
		new Setting(containerEl).addButton((b) =>
			b.setButtonText("Add snippet").onClick(async () => {
				s.snippets.push({ name: "", content: "" });
				await this.plugin.saveSettings();
				this.display();
			})
		);
	}
}
