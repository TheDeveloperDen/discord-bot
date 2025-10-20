import type {ExecutableSubcommand} from "djs-slash-helper";
import {ApplicationCommandOptionType, MessageFlags} from "discord.js";
import {logger} from "../logging.js";

const SelfTimeoutCommand: ExecutableSubcommand = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "selftimeout",
    description: "Timeout yourself",
    async handle(interaction) {
        try {
            if (!interaction.guild) {
                await interaction.followUp({
                    content: "This can only be done in a guild!",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            let member = await interaction.guild.members.fetch(interaction.user)
            if (member === null) return await interaction.followUp({
                content: "Yourself could not be found",
                flags: MessageFlags.Ephemeral,
            })
            await member.timeout(3600)
            await interaction.followUp('see you later')
        } catch (error) {
            logger.error("Failed to self-timeout:", error);
            await interaction.followUp({
                content: "An error occurred while timing out yourself.",
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};



