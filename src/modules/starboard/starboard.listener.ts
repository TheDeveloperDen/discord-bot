import type {
	Channel,
	Embed,
	GuildMember,
	Message,
	SendableChannels,
	Snowflake,
} from "discord.js";
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
} from "./starboard.js"; // Debounce system for starboard reactions

// Debounce system for starboard reactions
interface ReactionDebounceEntry {
	timeoutId: NodeJS.Timeout;
	addCount: number;
	removeCount: number;
}

const reactionDebounceMap = new Map<Snowflake, ReactionDebounceEntry>();
const DEBOUNCE_DELAY = 2000; // 2 seconds

export const debounceStarboardReaction = (
	messageId: Snowflake,
	isAdd: boolean,
	callback: () => Promise<void>,
): void => {
	const existing = reactionDebounceMap.get(messageId);

	if (existing) {
		// Clear the existing timeout
		clearTimeout(existing.timeoutId);

		// Update counters
		if (isAdd) {
			existing.addCount++;
		} else {
			existing.removeCount++;
		}

		// Check if we should cancel execution (equal adds and removes)
		const shouldCancel = existing.addCount === existing.removeCount;

		if (shouldCancel) {
			// Remove from map and don't execute
			reactionDebounceMap.delete(messageId);
			return;
		}
	} else {
		// Create new entry
		reactionDebounceMap.set(messageId, {
			timeoutId: setTimeout(() => {}, 0), // Placeholder, will be replaced immediately
			addCount: isAdd ? 1 : 0,
			removeCount: isAdd ? 0 : 1,
		});
	}

	const entry = reactionDebounceMap.get(messageId);
	if (!entry) {
		return;
	}

	// Set new timeout
	entry.timeoutId = setTimeout(async () => {
		try {
			await callback();
		} finally {
			reactionDebounceMap.delete(messageId);
		}
	}, DEBOUNCE_DELAY);
};

const messageFetcher = new MessageFetcher();

const getStarsFromEmbed: (embed: Embed) => number = (embed) => {
	const field = embed.fields.find((field) => field.name === "Details:");
	if (!field) return 0;

	const split = field.value.split("|");
	if (split.length < 2) return 0;
	const stars = split[0]?.split(":")[1]?.trim();
	if (!stars) return 0;
	return Number.parseInt(stars, 10);
};

const isChannelBlacklisted = (channel: Channel): boolean => {
	return config.starboard.blacklistChannelIds?.includes(channel.id) || false;
};

export const StarboardListener: EventListener = {
	async clientReady(client) {
		for (const guild of client.guilds.cache.values()) {
			try {
				const channels = await guild.channels.fetch();
				for (const channel of channels.values()) {
					if (
						channel?.isTextBased() &&
						channel.id !== config.starboard.channel &&
						!isChannelBlacklisted(channel)
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
						if (!channel?.isTextBased() || isChannelBlacklisted(channel))
							return;

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
						let message: Message | null = null;
						try {
							message = await channel.messages.fetch(
								dbStarboardMessage.originalMessageId.toString(),
							);
						} catch (e) {
							logger.error(
								"There was an error fetching the original Starboard message: ",
								e,
							);
							continue;
						}

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
		if (isChannelBlacklisted(reaction.message.channel)) return;
		if (reaction.partial) {
			// If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
			try {
				await reaction.fetch();
			} catch (error) {
				console.error(
					"Starboard: Something went wrong when fetching the reaction:",
					error,
				);
				// Return as `reaction.message.author` may be undefined/null
				return;
			}
		}

		let message = reaction.message;
		if (message.partial) {
			// If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
			try {
				message = await message.fetch();
			} catch (error) {
				console.error(
					"Starboard: Something went wrong when fetching the message:",
					error,
				);
				return;
			}
		}
		if (
			!message.inGuild() ||
			message.author.bot ||
			message.author.system ||
			message.channel.id === config.starboard.channel ||
			reaction.emoji.name !== config.starboard.emojiId
		)
			return;

		debounceStarboardReaction(message.id, true, async () => {
			reaction = await reaction.fetch();
			const count = reaction.count || 1;
			console.log(count, count >= config.starboard.threshold);

			if (count >= config.starboard.threshold) {
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

					const starboardMessageContent =
						await createStarboardMessageFromMessage(message, member, count);

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
		});
	},

	async messageReactionRemove(_, reaction) {
		if (isChannelBlacklisted(reaction.message.channel)) return;
		if (reaction.partial) {
			// If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
			try {
				await reaction.fetch();
			} catch (error) {
				console.error(
					"Starboard: Something went wrong when fetching the reaction:",
					error,
				);
				// Return as `reaction.message.author` may be undefined/null
				return;
			}
		}

		let message = reaction.message;
		if (message.partial) {
			// If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
			try {
				message = await message.fetch();
			} catch (error) {
				console.error(
					"Starboard: Something went wrong when fetching the message:",
					error,
				);
				return;
			}
		}
		if (
			!message.inGuild() ||
			message.author.bot ||
			message.author.system ||
			message.channel.id === config.starboard.channel ||
			reaction.emoji.name !== config.starboard.emojiId
		)
			return;

		debounceStarboardReaction(message.id, false, async () => {
			reaction = await reaction.fetch();
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
		});
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
		);
		await starboardMessage.edit(starboardMessageFromMessage);
		return;
	} catch (error) {
		logger.error("Error updating the starboard message", error);
		return;
	}
}
