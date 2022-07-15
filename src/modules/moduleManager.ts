import {Client, ClientEvents, Snowflake} from 'discord.js'
import Module from './module.js'
import EventEmitter from 'events'
import {CommandManager} from 'djs-slash-helper'

export default class ModuleManager {

	/**
	 * Creates a function, intended to replace `EventEmitter#emit`,
	 * allowing for us to dynamically dispatch events
	 */
	overrideEmit() {
		const modules = this.modules

		return function emit<K extends keyof ClientEvents>(this: Client, event: K, ...args: ClientEvents[K]) {
			for (const module of modules) {
				if (!module.listeners) continue
				for (const listener of module.listeners) {
					/**
					 * this expression creates a ridiculously complex union type that ts just can't handle,
					 * so we disable typechecking with the `any` cast. a simple @ts-ignore would not be
					 * sufficient here as it would still typecheck (which literally quadrupled the build
					 * time) but silently fail
					 */
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(listener as any)[event]?.(this, ...args)
				}
			}
			return EventEmitter.prototype.emit.call(this, event, ...args)
		}
	}

	private readonly commandManager: CommandManager

	constructor(private readonly client: Client,
				private readonly clientId: Snowflake,
				private readonly guildId: Snowflake,
				private readonly modules: Module[]) {
		client.emit = this.overrideEmit().bind(client)
		this.commandManager = new CommandManager(modules.flatMap(it => it.commands ?? []), client)
	}

	async refreshCommands() {
		await this.commandManager.setupForGuild(this.clientId, this.guildId)
	}
}
