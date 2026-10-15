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
		Sentry.captureException(error, {
			contexts: {
				member_lookup: {
					userId: message.author.id,
					messageId: message.id,
					channelId: message.channelId,
					authorIsWebhook: message.webhookId != null,
					messageAgeMs: Date.now() - message.createdTimestamp,
				},
			},
		});
		logger.error("Failed to fetch member:", error);
		return null;
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
		Sentry.captureException(error, {
			contexts: {
				member_lookup: {
					userId: interaction.user.id,
					interactionId: interaction.id,
					interactionType: interaction.type,
				},
			},
		});
		logger.error("Failed to fetch member:", error);
		return null;
	}
}
