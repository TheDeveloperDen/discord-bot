import {CommandInteraction, MessageContextMenuInteraction} from 'discord.js'

type Info = { name: string, toJSON(): unknown; }

/**
 * @deprecated
 */
export interface Command<T extends CommandInteraction | MessageContextMenuInteraction = CommandInteraction> {
	info?: Info

	getInfo?: () => Promise<Info>

	execute(interaction: T): Promise<void>;
}

export const commandInfo = async (command: Command<never>) => {
	if (command.info) return command.info
	if (command.getInfo) return await command.getInfo()
	throw new Error(`Command ${command} has no info`)
}
