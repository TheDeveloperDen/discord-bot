import type { Client, Interaction } from "discord.js";
import { runObserved } from "../observe.js";
import {
	type ComponentDefinition,
	type ComponentKind,
	parseCustomId,
	SEPARATOR,
} from "./component.js";

function kindOf(interaction: Interaction): ComponentKind | undefined {
	if (interaction.isButton()) return "button";
	if (interaction.isStringSelectMenu()) return "stringSelect";
	if (interaction.isModalSubmit()) return "modal";
	return undefined;
}

/** Dispatches button, select menu and modal interactions to the component that owns their customId */
export class ComponentRouter {
	constructor(
		private readonly components: ComponentDefinition[],
		client: Client,
	) {
		for (const [i, a] of components.entries()) {
			for (const [j, b] of components.entries()) {
				if (i !== j && (a.id === b.id || a.id.startsWith(b.id + SEPARATOR))) {
					throw new Error(
						`Component ids "${a.id}" and "${b.id}" overlap, so customIds would be ambiguous`,
					);
				}
			}
		}
		client.on("interactionCreate", (interaction) => {
			void this.dispatch(interaction);
		});
	}

	private async dispatch(interaction: Interaction) {
		const kind = kindOf(interaction);
		if (!kind || !("customId" in interaction)) return;
		for (const component of this.components) {
			if (component.kind !== kind) continue;
			const args = parseCustomId(component, interaction.customId);
			if (!args) continue;
			// unowned ids fall through untouched so collectors and the modmail listener etc handle their own
			await runObserved(
				{ op: "component", name: component.id, interaction },
				() => component.handle(interaction as never, args),
			);
			return;
		}
	}
}
