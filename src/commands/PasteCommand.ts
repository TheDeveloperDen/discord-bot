import {SlashCommandBuilder} from "@discordjs/builders";
import {CommandInteraction} from "discord.js";
import {Command} from "./Commands.js";

export class PasteCommand implements Command {
    info = new SlashCommandBuilder()
        .setName("paste")
        .setDescription("Show the paste link")

    async execute(interaction: CommandInteraction) {
        await interaction.reply('https://paste.developerden.net')
    }
}