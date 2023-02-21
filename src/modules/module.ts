import {Command} from 'djs-slash-helper'
import {Awaitable, Client, ClientEvents} from 'discord.js'
import {ApplicationCommandType} from 'discord-api-types/v10'

export type EventListener = { [k in keyof ClientEvents]?: (client: Client, ...args: ClientEvents[k]) => Awaitable<unknown> }

export default interface Module {
	name: string,
	commands?: Command<ApplicationCommandType>[],
	listeners?: EventListener[],

	/**
	 * Called *before* command registration
	 * @param client The client that is being used.
	 */
	preInit?: (client: Client) => Awaitable<void>,

	/**
	 * Called when the module is initialized, after command registration
	 * @param client The client that is being used.
	 */
	onInit?: (client: Client) => Awaitable<void>,
}
