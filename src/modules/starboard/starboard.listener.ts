import type { Embed, GuildMember, Message, SendableChannels } from "discord.js";
import * as schedule from "node-schedule";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { StarboardMessage } from "../../store/models/StarboardMessage.js";
import { getMember } from "../../util/member.js";
import { MessageFetcher } from "../../util/ratelimiting.js";
import type { EventListener } from "../module.js";
import {
	createStarboardMessage,
	createStarboardMessageFromMessage,
	getStarboardMessageForOriginalMessageId,
} from "./starboard.js";

const messageFetcher = new MessageFetcher();

const getStarsFromEmbed: (embed: Embed) => number = (embed) => {
	const field = embed.fields.find((field) => field.name === "Details:");
	if (!field) return 0;

	const split = field.value.split("|");
	if (split.length < 2) return 0;
	const stars = split[0]?.split(":")[1]?.trim();
	if (!stars) return 0;
	return parseInt(stars, 10);
};

export const StarboardListener: EventListener = {
	async clientReady(client) {
		for (const guild of client.guilds.cache.values()) {
			try {
				const channels = await guild.channels.fetch();
				for (const channel of channels.values()) {
					if (
						channel?.isTextBased() &&
						channel.id !== config.starboard.channel
					) {
						// Add to rate-limited queue
						await messageFetcher.addToQueue(async () => {
							try {
								await channel.messages.fetch({ limit: 100 }); // 100 is the maximum allowed by Discord API
								logger.info(`Fetched recent messages from #%s`, channel.name);
							} catch (error) {
								logger.error(
									`Error fetching messages from #%s`,
									channel.name,
									error,
								);
							}
						});
					}
				}
			} catch (error) {
				logger.error(`Error processing guild %s:`, guild.name, error);
			}
		}
		let isRunningStarboardCheck = false;
		schedule.scheduleJob(
			{
				hour: 0,
				minute: 0,
				second: 0,
			},
			async () => {
				if (isRunningStarboardCheck) {
					return;
				}
				isRunningStarboardCheck = true;
				try {
					logger.info("Starting daily starboard check...");
					const starboardMessages = await StarboardMessage.findAll();
					for (const dbStarboardMessage of starboardMessages) {
						const guild = await client.guilds.fetch(config.guildId);

						const channel = await guild.channels.fetch(
							dbStarboardMessage.originalMessageChannelId.toString(),
						);
						if (!channel || !channel.isTextBased()) return; // Channel is not available? ( Either we can hope it comes back or we can delete the entry from the database )

						const starboardChannel = await guild.channels.fetch(
							config.starboard.channel,
						);
						if (
							!starboardChannel ||
							!starboardChannel.isTextBased() ||
							!starboardChannel.isSendable()
						) {
							logger.error(
								"Starboard channel not found, not a text channel or not sendable",
							);
							return;
						}

						const message = await channel.messages.fetch(
							dbStarboardMessage.originalMessageId.toString(),
						);
						const member = await getMember(message);
						if (!member) {
							logger.error(
								"Member not found for message %s",
								dbStarboardMessage.originalMessageId,
							);
							continue;
						}
						const starboardMessage = await starboardChannel.messages.fetch(
							dbStarboardMessage.starboardMessageId.toString(),
						);

						if (!message) {
							await starboardMessage.delete();
							await dbStarboardMessage.destroy();
							continue;
						}

						if (!starboardMessage) {
							await dbStarboardMessage.destroy();
							continue;
						}

						const messageStarCount =
							message.reactions.cache.get(config.starboard.emojiId)?.count || 0;
						const starboardStarCount = getStarsFromEmbed(
							starboardMessage.embeds[0],
						);
						if (messageStarCount !== starboardStarCount) {
							const starboardMessageContent =
								await createStarboardMessageFromMessage(
									message,
									member,
									messageStarCount,
								);
							await starboardMessage.edit(starboardMessageContent);
							logger.info(
								`Starboard message %s for message %s has been updated`,
								dbStarboardMessage.starboardMessageId,
								dbStarboardMessage.originalMessageId,
							);
						}

						logger.info(
							`Starboard message %s for message %s has been checked`,
							dbStarboardMessage.starboardMessageId,
							dbStarboardMessage.originalMessageId,
						);

						await new Promise((resolve) => setTimeout(resolve, 1000));
					}
				} finally {
					isRunningStarboardCheck = false;
				}
			},
		);
	},
	async messageReactionAdd(_, reaction) {
		let message = reaction.message;
		if (message.partial) message = await reaction.message.fetch();
		if (
			!message.inGuild() ||
			message.author.bot ||
			message.author.system ||
			message.channel.id === config.starboard.channel ||
			reaction.emoji.name !== config.starboard.emojiId
		)
			return;
		await reaction.fetch();
		const count = reaction.count || 1;
		if (count >= config.starboard.threshold) {
			const starboardChannel = await message.guild.channels.fetch(
				config.starboard.channel,
			);

			if (!starboardChannel?.isTextBased() || !starboardChannel.isSendable()) {
				logger.error(
					"Starboard channel not found, not a text channel or not sendable",
				);
				return;
			}
			const existingStarboardMessage =
				await getStarboardMessageForOriginalMessageId(message.id);
			try {
				const member = await getMember(message);

				if (!member) {
					logger.info(
						"Member not found for reaction message id %s, skipping",
						message.id,
					);
					return;
				}
				if (existingStarboardMessage) {
					// Already on the starboard so update it
					await updateStarboardMessage(
						starboardChannel,
						existingStarboardMessage,
						message,
						member,
						count,
					);
					return;
				}

				const starboardMessageContent = await createStarboardMessageFromMessage(
					message,
					member,
					count,
				);

				const starboardMessage = await starboardChannel.send({
					...starboardMessageContent,
					allowedMentions: {
						parse: [],
					},
				});
				if (!existingStarboardMessage) {
					await createStarboardMessage(
						message.id,
						message.channelId,
						starboardMessage.id,
					);
				}
			} catch (error) {
				logger.error("Error sending starboard message", error);
			}
		}
	},
	async messageReactionRemove(_, reaction) {
		let message = reaction.message;
		if (message.partial) message = await reaction.message.fetch();
		if (
			!message.inGuild() ||
			message.author.bot ||
			message.author.system ||
			message.channel.id === config.starboard.channel ||
			reaction.emoji.name !== config.starboard.emojiId
		)
			return;
		await reaction.fetch();
		const count = reaction.count || 0;
		const existingStarboardMessage =
			await getStarboardMessageForOriginalMessageId(message.id);
		if (!existingStarboardMessage) return;
		try {
			const member = await getMember(message);

			if (!member) {
				logger.info(
					"Member not found for reaction message id: %s",
					reaction.message.id,
				);
				return;
			}

			if (existingStarboardMessage) {
				const starboardChannel = await message.guild.channels.fetch(
					config.starboard.channel,
				);
				if (
					!starboardChannel?.isTextBased() ||
					!starboardChannel.isSendable()
				) {
					logger.error(
						"Starboard channel not found, not a text channel or not sendable",
					);
					return;
				}

				await updateStarboardMessage(
					starboardChannel,
					existingStarboardMessage,
					message,
					member,
					count,
				);
			}
		} catch (error) {
			logger.error("Error sending starboard message", error);
		}
	},
};

async function updateStarboardMessage(
	starboardChannel: SendableChannels,
	starboardMessageEntity: StarboardMessage,
	reactionMessage: Message<true>,
	member: GuildMember,
	starCount: number,
) {
	try {
		let starboardMessage: Message | null;
		try {
			starboardMessage = await starboardChannel.messages.fetch(
				starboardMessageEntity.starboardMessageId.toString(),
			);
		} catch (error) {
			// we can't find the message on discord, but it's not necessarily deleted. keep it in database in case of connection issues
			// or just for archiving
			starboardMessage = null;
			logger.error("Error fetching the starboard message", error);
		}

		if (!starboardMessage) {
			return; // nothing to do for now
		}
		// create a new database entry
		const starboardMessageFromMessage = await createStarboardMessageFromMessage(
			reactionMessage,
			member,
			starCount,
			starboardMessage,
		);
		await starboardMessage.edit(starboardMessageFromMessage);
		return;
	} catch (error) {
		logger.error("Error updating the starboard message", error);
		return;
	}
}
