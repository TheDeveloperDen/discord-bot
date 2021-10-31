import {Command} from "./Command";
import {SlashCommandBuilder} from "@discordjs/builders";
import {CommandInteraction} from "discord.js";

class PasteCommand implements Command {
    info: SlashCommandBuilder = new SlashCommandBuilder()
        .setName("paste")
        .setDescription("Show the paste link")

    async execute(interaction: CommandInteraction) {
        await interaction.reply('https://paste.developerden.net')
    }
}

module.exports = new PasteCommand()