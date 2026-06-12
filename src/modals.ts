import {
	AbstractInputSuggest,
	App,
	Modal,
	Setting,
	TFolder,
} from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(app: App, private input: HTMLInputElement) {
		super(app, input);
	}

	getSuggestions(query: string): TFolder[] {
		const q = query.toLowerCase();
		return this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder)
			.filter((f) => f.path.toLowerCase().contains(q))
			.slice(0, 50);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path || "/");
	}

	selectSuggestion(folder: TFolder): void {
		this.input.value = folder.path;
		this.input.trigger("input");
		this.close();
	}
}

export interface ExtractModalResult {
	name: string;
	folder: string;
	asEmbed: boolean;
}

/** Preview modal for "Extract to new note": file name + target folder + link style. */
export class ExtractModal extends Modal {
	private name: string;
	private folder: string;
	private asEmbed: boolean;

	constructor(
		app: App,
		defaults: ExtractModalResult,
		private onSubmit: (result: ExtractModalResult) => void
	) {
		super(app);
		this.name = defaults.name;
		this.folder = defaults.folder;
		this.asEmbed = defaults.asEmbed;
	}

	onOpen(): void {
		this.titleEl.setText("Extract to new note");
		const { contentEl } = this;

		new Setting(contentEl).setName("File name").addText((t) => {
			t.setValue(this.name).onChange((v) => (this.name = v));
			t.inputEl.addClass("intentions-extract-name");
			t.inputEl.focus();
			t.inputEl.select();
		});

		new Setting(contentEl)
			.setName("Location")
			.setDesc("Folder for the new note.")
			.addText((t) => {
				new FolderSuggest(this.app, t.inputEl);
				t.setValue(this.folder).onChange((v) => (this.folder = v));
			});

		new Setting(contentEl)
			.setName("Insert as embed")
			.setDesc("![[note]] instead of [[note]].")
			.addToggle((t) => t.setValue(this.asEmbed).onChange((v) => (this.asEmbed = v)));

		new Setting(contentEl)
			.addButton((b) =>
				b.setButtonText("Create").setCta().onClick(() => this.submit())
			)
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));

		this.scope.register([], "Enter", (e) => {
			e.preventDefault();
			this.submit();
			return false;
		});
	}

	private submit(): void {
		if (!this.name.trim()) return;
		this.close();
		this.onSubmit({ name: this.name.trim(), folder: this.folder.trim(), asEmbed: this.asEmbed });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Single-input prompt (e.g. code block language). */
export class TextPromptModal extends Modal {
	private value: string;

	constructor(
		app: App,
		private title: string,
		private label: string,
		initial: string,
		private onSubmit: (value: string) => void
	) {
		super(app);
		this.value = initial;
	}

	onOpen(): void {
		this.titleEl.setText(this.title);
		new Setting(this.contentEl).setName(this.label).addText((t) => {
			t.setValue(this.value).onChange((v) => (this.value = v));
			t.inputEl.focus();
			t.inputEl.select();
		});
		new Setting(this.contentEl).addButton((b) =>
			b.setButtonText("OK").setCta().onClick(() => this.submit())
		);
		this.scope.register([], "Enter", (e) => {
			e.preventDefault();
			this.submit();
			return false;
		});
	}

	private submit(): void {
		this.close();
		this.onSubmit(this.value.trim());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Name + value prompt for adding a frontmatter property. */
export class PropertyModal extends Modal {
	private name = "";
	private value = "";

	constructor(app: App, private onSubmit: (name: string, value: string) => void) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText("Add property");
		new Setting(this.contentEl).setName("Name").addText((t) => {
			t.onChange((v) => (this.name = v));
			t.inputEl.focus();
		});
		new Setting(this.contentEl).setName("Value").addText((t) =>
			t.onChange((v) => (this.value = v))
		);
		new Setting(this.contentEl).addButton((b) =>
			b.setButtonText("Add").setCta().onClick(() => this.submit())
		);
		this.scope.register([], "Enter", (e) => {
			e.preventDefault();
			this.submit();
			return false;
		});
	}

	private submit(): void {
		if (!this.name.trim()) return;
		this.close();
		this.onSubmit(this.name.trim(), this.value.trim());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
