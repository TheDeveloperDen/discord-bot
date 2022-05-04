import {CommandInteraction, MessageContextMenuInteraction} from 'discord.js'

export interface Command<T extends CommandInteraction | MessageContextMenuInteraction = CommandInteraction> {
	info: { name: string, toJSON(): unknown; }

	execute(interaction: T): Promise<void>;
}
