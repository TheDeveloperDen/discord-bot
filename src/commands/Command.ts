import {CommandInteraction} from "discord.js";
import {RESTPostAPIApplicationCommandsJSONBody} from "discord-api-types";

export interface Command {
    info: { name: string, toJSON(): RESTPostAPIApplicationCommandsJSONBody; }

    execute(interaction: CommandInteraction): Promise<void>;
}