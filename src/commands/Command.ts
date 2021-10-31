import {CommandInteraction} from "discord.js";
import {SlashCommandBuilder} from "@discordjs/builders";

export interface Command {
    info: SlashCommandBuilder

    execute(interaction: CommandInteraction): Promise<void>;
}