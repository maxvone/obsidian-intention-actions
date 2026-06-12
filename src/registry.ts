import type { IntentionsSettings } from "./settings";
import type { IntentionAction, IntentionContext } from "./types";

export class ActionRegistry {
	private actions: IntentionAction[] = [];

	register(...actions: IntentionAction[]): void {
		this.actions.push(...actions);
	}

	/** Public extension point (roadmap v4): other plugins may register their own actions. */
	registerExternal(action: IntentionAction): () => void {
		this.actions.push(action);
		return () => {
			this.actions = this.actions.filter((a) => a !== action);
		};
	}

	getAvailable(ctx: IntentionContext, settings: IntentionsSettings): IntentionAction[] {
		return this.actions.filter((a) => {
			if (!settings.groups[a.group]) return false;
			try {
				return a.isAvailable(ctx);
			} catch {
				return false;
			}
		});
	}
}
