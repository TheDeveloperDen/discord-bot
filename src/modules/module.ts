import {Command} from 'djs-slash-helper'
import {Awaitable, Client, ClientEvents} from 'discord.js'

export type EventListener = { [k in keyof ClientEvents]?: (client: Client, ...args: ClientEvents[k]) => Awaitable<unknown> }

export default interface Module {
	name: string,
	commands?: Command<never>[],
	listeners?: EventListener[],
}
