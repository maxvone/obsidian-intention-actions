import { Notice } from "obsidian";
import { markdownToWiki, wikiToMarkdown } from "../markdown-utils";
import type IntentionActionsPlugin from "../main";
import type { IntentionAction, IntentionContext } from "../types";

const onLink = (ctx: IntentionContext): boolean => ctx.link !== null;
const isExternal = (target: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(target);

function replaceLink(ctx: IntentionContext, text: string): void {
	ctx.editor.transaction({
		changes: [
			{
				from: { line: ctx.cursor.line, ch: ctx.link!.start },
				to: { line: ctx.cursor.line, ch: ctx.link!.end },
				text,
			},
		],
	});
}

export function linkActions(plugin: IntentionActionsPlugin): IntentionAction[] {
	return [
		{
			id: "open-link",
			title: "Open linked note",
			icon: "external-link",
			group: "link",
			isAvailable: onLink,
			execute: (ctx) => {
				const link = ctx.link!;
				if (link.type === "md" && isExternal(link.target)) {
					window.open(link.target);
					return;
				}
				let target = link.target;
				if (link.type === "md") {
					try {
						target = decodeURI(target);
					} catch {
						// keep raw target
					}
					target = target.replace(/\.md$/, "");
				}
				plugin.app.workspace.openLinkText(target, ctx.file.path, false);
			},
		},
		{
			id: "wiki-to-markdown",
			title: "Convert to markdown link",
			icon: "link-2",
			group: "link",
			isAvailable: (ctx) => ctx.link?.type === "wiki",
			execute: (ctx) => replaceLink(ctx, wikiToMarkdown(ctx.link!)),
		},
		{
			id: "markdown-to-wiki",
			title: "Convert to wikilink",
			icon: "brackets",
			group: "link",
			isAvailable: (ctx) => ctx.link?.type === "md" && !isExternal(ctx.link.target),
			execute: (ctx) => replaceLink(ctx, markdownToWiki(ctx.link!)),
		},
		{
			id: "copy-link-target",
			title: "Copy link target",
			icon: "copy",
			group: "link",
			isAvailable: onLink,
			execute: async (ctx) => {
				await navigator.clipboard.writeText(ctx.link!.target);
				new Notice("Link target copied");
			},
		},
	];
}
