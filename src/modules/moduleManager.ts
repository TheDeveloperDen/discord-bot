import * as Sentry from "@sentry/bun";
import type { Client, ClientEvents, Snowflake } from "discord.js";
import { CommandManager } from "../commands/index.js";
import { logger } from "../logging.js";
import { runObserved } from "../observe.js";
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
					const handler = listener[event];
					if (handler == null) continue;

					// we don't pass `interaction` here because listeners see interactions they don't own, so an error reply would race the real handler's reply.
					void runObserved(
						{
							op: "event",
							name: `${module.name}.${event}`,
							tags: { module: module.name, event },
						},
						() => handler(this, ...args),
					);
				}
			}
			return previousEmit.call(this, event, ...args);
		};
	}

	/**
	 * Runs a lifecycle hook on every module concurrently and waits for all of them, reporting but not halting on errors
	 */
	private async runHook(
		hook: "preInit" | "onInit",
		run: (module: Module) => Promise<void> | undefined,
	) {
		// turn any thrown exceptions into rejected promises
		const results = await Promise.allSettled(
			this.modules.map(async (module) => run(module)),
		);
		results.forEach((result, i) => {
			if (result.status === "rejected") {
				const module = this.modules[i].name;
				Sentry.captureException(result.reason, { tags: { module, hook } });
				logger.error(`Error in ${hook} for module ${module}`, result.reason);
			}
		});
	}

	/** Called before login once storage is ready */
	async preInit() {
		await this.runHook("preInit", (module) => module.preInit?.(this.client));
	}

	/** Registers guild and global commands with Discord */
	async refreshCommands() {
		await this.guildCommandManager.setupForGuild(this.clientId, this.guildId);
		await this.globalCommandManager.setupGlobally(this.clientId);
	}

	/** Called once commands are registered */
	async init() {
		await this.runHook("onInit", (module) =>
			module.onInit?.(this, this.client),
		);
	}

	getModules() {
		return this.modules;
	}
}

let instance: ModuleManager | null = null;

export function setModuleManager(manager: ModuleManager) {
	instance = manager;
}

export function getModuleManager(): ModuleManager {
	if (instance == null) {
		throw new Error("ModuleManager not initialised");
	}
	return instance;
}
