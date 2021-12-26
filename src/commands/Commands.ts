import {CommandInteraction} from "discord.js";

import {PasteCommand} from "./PasteCommand.js";
import {XPCommand} from "./XPCommand.js";

export interface Command {
    info: { name: string, toJSON(): any; }

    execute(interaction: CommandInteraction): Promise<void>;
}

export const commands = [PasteCommand, XPCommand]