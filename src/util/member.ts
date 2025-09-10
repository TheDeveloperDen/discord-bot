import * as Sentry from "@sentry/bun";
import type { GuildMember, Interaction, Message } from "discord.js";
import { logger } from "../logging.js";

export async function getMember(message: Message) {
	if (!message.inGuild()) return null;

	if (message.member) {
		return message.member;
	}

	try {
		return await message.guild.members.fetch(message.author.id);
	} catch (error) {
		logger.error("Failed to fetch member:", error);
		Sentry.captureException(error);
	}
}
export async function getMemberFromInteraction(interaction: Interaction) {
	if (!interaction.inGuild()) return null;

	if (interaction.member) {
		if (typeof interaction.member.permissions === "string") {
			return await interaction.guild?.members.fetch(interaction.user.id);
		}
		return interaction.member as GuildMember;
	}

	try {
		return await interaction.guild?.members.fetch(interaction.user.id);
	} catch (error) {
		logger.error("Failed to fetch member:", error);
		Sentry.captureException(error);
	}
}
