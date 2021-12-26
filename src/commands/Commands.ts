import {ApplicationCommand, CommandInteraction} from "discord.js";

import {PasteCommand} from "./PasteCommand.js";
import {XPCommand} from "./XPCommand.js";
import {RoleCommand} from "./RoleCommand.js";
import {SetCommand} from "./SetCommand.js";
import {InfoCommand} from "./InfoCommand.js";

export interface Command {
    info: { name: string, toJSON(): any; }

    execute(interaction: CommandInteraction): Promise<void>;

    init?(command: ApplicationCommand): Promise<void>;
}

export const commands = [PasteCommand, XPCommand, RoleCommand, SetCommand, InfoCommand]