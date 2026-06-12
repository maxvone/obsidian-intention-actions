import {
	EditorPosition,
	normalizePath,
	Notice,
	TFile,
	TFolder,
} from "obsidian";
import { formatNow } from "./moment-shim";
import { frontmatterRange, renderNameTemplate } from "./markdown-utils";
import { ExtractModal } from "./modals";
import type IntentionActionsPlugin from "./main";
import type { IntentionContext } from "./types";

/**
 * Shared "extract to new note" flow: preview modal (name + folder + link style),
 * then create the note and replace [replaceFrom, replaceTo] with a generated link.
 */
export function openExtractFlow(
	plugin: IntentionActionsPlugin,
	ctx: IntentionContext,
	text: string,
	replaceFrom: EditorPosition,
	replaceTo: EditorPosition
): void {
	const s = plugin.settings;
	const defaultName =
		renderNameTemplate(s.extractNameTemplate, {
			selection: text,
			date: formatNow(s.dateFormat),
			parent: ctx.file.basename,
		}) || "Untitled";
	const folder = s.extractDefaultFolder || ctx.file.parent?.path || "";

	new ExtractModal(
		plugin.app,
		{ name: defaultName, folder, asEmbed: s.extractAsEmbed },
		async (res) => {
			try {
				const newFile = await createExtractedNote(plugin, ctx, text, res.name, res.folder);
				let link = plugin.app.fileManager.generateMarkdownLink(newFile, ctx.file.path);
				if (res.asEmbed && !link.startsWith("!")) link = "!" + link;
				ctx.editor.transaction({
					changes: [{ from: replaceFrom, to: replaceTo, text: link }],
				});
				new Notice(`Created ${newFile.path}`);
			} catch (err) {
				console.error("[intention-actions]", err);
				new Notice(`Extract failed: ${(err as Error)?.message ?? err}`);
			}
		}
	).open();
}

async function createExtractedNote(
	plugin: IntentionActionsPlugin,
	ctx: IntentionContext,
	text: string,
	name: string,
	folder: string
): Promise<TFile> {
	const app = plugin.app;
	const folderPath = normalizePath(folder || "/");
	if (folderPath && folderPath !== "/") {
		const existing = app.vault.getAbstractFileByPath(folderPath);
		if (!existing) await app.vault.createFolder(folderPath);
		else if (!(existing instanceof TFolder)) {
			throw new Error(`"${folderPath}" is not a folder`);
		}
	}

	let content = text.endsWith("\n") ? text : text + "\n";
	if (plugin.settings.extractCopyFrontmatter) {
		const lines = ctx.editor.getValue().split("\n");
		const fm = frontmatterRange(lines);
		if (fm) content = lines.slice(fm[0], fm[1] + 1).join("\n") + "\n\n" + content;
	}

	const base = folderPath === "/" || folderPath === "" ? "" : folderPath + "/";
	let path = normalizePath(`${base}${name}.md`);
	let n = 1;
	while (app.vault.getAbstractFileByPath(path)) {
		path = normalizePath(`${base}${name} ${n++}.md`);
	}
	return app.vault.create(path, content);
}
