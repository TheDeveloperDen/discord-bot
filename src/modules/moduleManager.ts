import * as Sentry from "@sentry/node";
import type { Client, ClientEvents, Snowflake } from "discord.js";
import { CommandManager } from "djs-slash-helper";
import { logger } from "../logging.js";
import type Module from "./module.js";

export default class ModuleManager {
	private readonly guildCommandManager: CommandManager;
	private readonly globalCommandManager: CommandManager;
	private readonly originalEmit;

	constructor(
		private readonly client: Client,
		private readonly clientId: Snowflake,
		private readonly guildId: Snowflake,
		private readonly modules: Module[],
	) {
		this.originalEmit = this.client.emit;
		client.emit = this.overrideEmit().bind(client);

		for (const module of modules) {
			module.preInit?.(client)?.catch((e) => {
				Sentry.captureException(e);
				logger.error(`Error in preInit for module ${module.name}`, e);
			});
		}

		// Separate guild and global commands
		const guildCommands = modules.flatMap((it) => it.commands ?? []);
		const globalCommands = modules.flatMap((it) => it.globalCommands ?? []);

		this.guildCommandManager = new CommandManager(guildCommands, client);
		this.globalCommandManager = new CommandManager(globalCommands, client);
	}

	/**
	 * Creates a function, intended to replace `EventEmitter#emit`,
	 * allowing for us to dynamically dispatch events
	 */
	overrideEmit() {
		const modules = this.modules;
		const previousEmit = this.originalEmit;

		return function emit<K extends keyof ClientEvents>(
			this: Client,
			event: K,
			...args: ClientEvents[K]
		) {
			for (const module of modules) {
				if (module.listeners == null) continue;
				for (const listener of module.listeners) {
					listener[event]?.(this, ...args);
				}
			}
			return previousEmit.call(this, event, ...args);
		};
	}

	async refreshCommands() {
		for (const module of this.modules) {
			module.onCommandInit?.(this.client)?.catch((e) => {
				Sentry.captureException(e);
				logger.error(`Error in onCommandInit for module ${module.name}`, e);
			});
		}

		// Set up guild-specific commands
		await this.guildCommandManager.setupForGuild(this.clientId, this.guildId);

		// Set up global commands
		if (this.globalCommandManager) {
			await this.globalCommandManager.setupGlobally(this.clientId);
		}
	}

	getModules() {
		return this.modules;
	}
}
