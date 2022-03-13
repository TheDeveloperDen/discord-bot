import {ApplicationCommand, CommandInteraction, MessageContextMenuInteraction} from 'discord.js'

import {PasteCommand} from './PasteCommand.js'
import {XPCommand} from './XPCommand.js'
import {RoleCommand} from './RoleCommand.js'
import {SetCommand} from './SetCommand.js'
import {InfoCommand} from './InfoCommand.js'
import {HotTakeCommand} from './HotTakeCommand.js'
import {ColourRoleCommand} from './ColourRoleCommand.js'
import {TimeoutCommand} from './TimeoutCommand.js'
import {PastifyCommand} from './PastifyCommand.js'

export interface Command<T extends CommandInteraction | MessageContextMenuInteraction = CommandInteraction> {
	info: { name: string, toJSON(): unknown; }

	execute(interaction: T): Promise<void>;

	init?(command: ApplicationCommand): Promise<void>;
}

export const commands = [PasteCommand, XPCommand, RoleCommand, SetCommand, InfoCommand, HotTakeCommand,
	ColourRoleCommand, TimeoutCommand, PastifyCommand]
