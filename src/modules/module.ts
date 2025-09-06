import type {
	ApplicationCommandType,
	Awaitable,
	Client,
	ClientEvents,
} from "discord.js";
import type { Command } from "djs-slash-helper";

import type ModuleManager from "./moduleManager.js";

export type EventListener = {
	[k in keyof ClientEvents]?: (
		client: Client,
		...args: ClientEvents[k]
	) => Awaitable<unknown>;
};

export default interface Module {
	name: string;
	commands?: Array<Command<ApplicationCommandType>>;
	globalCommands?: Array<Command<ApplicationCommandType>>;
	listeners?: EventListener[];

	/**
	 * Called *before* command registration
	 * @param client The client that is being used.
	 */
	preInit?: (client: Client) => Promise<void>;

	/**
	 * Called immediately *after* command registration
	 * @param client
	 */
	onCommandInit?: (client: Client) => Promise<void>;

	/**
	 * Called when the module is initialized, after command registration
	 * @param client The client that is being used.
	 */
	onInit?: (manager: ModuleManager, client: Client) => Promise<void>;
}
