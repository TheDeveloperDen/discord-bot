import type {
	Channel,
	GuildMember,
	Message,
	SendableChannels,
	Snowflake,
} from "discord.js";
import * as schedule from "node-schedule";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { AntiStarboardMessage } from "../../store/models/AntiStarboardMessage.js";
import { ReputationEventType } from "../../store/models/ReputationEvent.js";
import { StarboardMessage } from "../../store/models/StarboardMessage.js";
import { getMember } from "../../util/member.js";
import { grantReputation } from "../moderation/reputation.service.js";
import type { EventListener } from "../module.js";
import {
	createAntiStarboardMessage,
	createStarboardMessage,
	createStarboardMessageFromMessage,
	getAntiStarboardMessageForOriginalMessageId,
	getStarboardMessageForOriginalMessageId,
	type StarboardRenderOptions,
} from "./starboard.js";
import {
	getReactionCountForEmoji,
	getThresholdReactionCount,
	matchesConfiguredEmoji,
} from "./starboard.reaction-utils.js";

interface ReactionDebounceEntry {
	timeoutId: NodeJS.Timeout;
	addCount: number;
	removeCount: number;
}

type BoardKey = "starboard" | "antiStarboard";
type BoardMessageRecord = StarboardMessage | AntiStarboardMessage;

interface BoardRuntimeConfig extends StarboardRenderOptions {
	channel: Snowflake;
	blacklistChannelIds?: Snowflake[];
}

interface BoardDefinition {
	key: BoardKey;
	name: string;
	config: BoardRuntimeConfig;
	model: typeof StarboardMessage | typeof AntiStarboardMessage;
	getMessageForOriginalMessageId: (
		originalMessageId: Snowflake,
	) => Promise<BoardMessageRecord | null>;
	createMessage: (
		originalMessageId: Snowflake,
		originalMessageChannelId: Snowflake,
		starboardMessageId: Snowflake,
	) => Promise<BoardMessageRecord>;
	grantReputation: boolean;
}

function buildBoardDefinitions(): BoardDefinition[] {
	const boards: BoardDefinition[] = [
		{
			key: "starboard",
			name: "starboard",
			config: {
				emojiId: config.starboard.emojiId,
				channel: config.starboard.channel,
				threshold: config.starboard.threshold,
				color: config.starboard.color,
				blacklistChannelIds: config.starboard.blacklistChannelIds,
			},
			model: StarboardMessage,
			getMessageForOriginalMessageId: getStarboardMessageForOriginalMessageId,
			createMessage: createStarboardMessage,
			grantReputation: true,
		},
	];

	if (config.antiStarboard) {
		boards.push({
			key: "antiStarboard",
			name: "anti-starboard",
			config: {
				emojiId: config.antiStarboard.emojiId,
				channel: config.antiStarboard.channel,
				threshold: config.antiStarboard.threshold,
				color: config.antiStarboard.color,
				blacklistChannelIds: config.antiStarboard.blacklistChannelIds,
			},
			model: AntiStarboardMessage,
			getMessageForOriginalMessageId:
				getAntiStarboardMessageForOriginalMessageId,
			createMessage: createAntiStarboardMessage,
			grantReputation: false,
		});
	}

	return boards;
}

const boardDefinitions = buildBoardDefinitions();
const reactionDebounceMap = new Map<string, ReactionDebounceEntry>();
const DEBOUNCE_DELAY = 2000;

const getDebounceKey = (boardKey: BoardKey, messageId: Snowflake): string => {
	return `${boardKey}:${messageId}`;
};

const getBoardForReaction = (
	emojiName: string | null,
	emojiId: string | null,
): BoardDefinition | null => {
	if (!emojiName && !emojiId) {
		return null;
	}

	for (const board of boardDefinitions) {
		if (matchesConfiguredEmoji(emojiName, emojiId, board.config.emojiId)) {
			return board;
		}
	}

	return null;
};

const isBoardChannel = (channelId: Snowflake): boolean => {
	return boardDefinitions.some((board) => board.config.channel === channelId);
};

export const debounceStarboardReaction = (
	boardKey: BoardKey,
	messageId: Snowflake,
	isAdd: boolean,
	callback: () => Promise<void>,
): void => {
	const key = getDebounceKey(boardKey, messageId);
	const existing = reactionDebounceMap.get(key);

	if (existing) {
		clearTimeout(existing.timeoutId);

		if (isAdd) {
			existing.addCount++;
		} else {
			existing.removeCount++;
		}

		if (existing.addCount === existing.removeCount) {
			reactionDebounceMap.delete(key);
			return;
		}
	} else {
		reactionDebounceMap.set(key, {
			timeoutId: setTimeout(() => {}, 0),
			addCount: isAdd ? 1 : 0,
			removeCount: isAdd ? 0 : 1,
		});
	}

	const entry = reactionDebounceMap.get(key);
	if (!entry) {
		return;
	}

	entry.timeoutId = setTimeout(async () => {
		try {
			await callback();
		} finally {
			reactionDebounceMap.delete(key);
		}
	}, DEBOUNCE_DELAY);
};

const isChannelBlacklisted = (
	channel: Channel,
	board: BoardDefinition,
): boolean => {
	return board.config.blacklistChannelIds?.includes(channel.id) || false;
};

const getReactionCountForBoard = (
	message: Message,
	board: BoardDefinition,
): number => {
	return getReactionCountForEmoji(message, board.config.emojiId);
};

const getBoardByKey = (key: BoardKey): BoardDefinition | undefined => {
	return boardDefinitions.find((board) => board.key === key);
};

const getDisplayCountForBoard = (
	message: Message,
	board: BoardDefinition,
): number => {
	const boardCount = getReactionCountForBoard(message, board);
	if (board.key !== "starboard") {
		return boardCount;
	}

	const antiStarboard = getBoardByKey("antiStarboard");
	if (!antiStarboard) {
		return boardCount;
	}

	const antiStarCount = getReactionCountForBoard(message, antiStarboard);
	return Math.max(boardCount - antiStarCount, 0);
};

const getContentCountForBoard = (
	message: Message,
	board: BoardDefinition,
): number => {
	return getReactionCountForBoard(message, board);
};

export const StarboardListener: EventListener = {
	async clientReady(client) {
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
					const guild = await client.guilds.fetch(config.guildId);

					for (const board of boardDefinitions) {
						logger.info(`Starting daily ${board.name} check...`);
						const boardMessages = await board.model.findAll();

						for (const dbBoardMessage of boardMessages) {
							const channel = await guild.channels.fetch(
								dbBoardMessage.originalMessageChannelId.toString(),
							);
							if (
								!channel?.isTextBased() ||
								isChannelBlacklisted(channel, board)
							) {
								continue;
							}

							const boardChannel = await guild.channels.fetch(
								board.config.channel,
							);
							if (
								!boardChannel ||
								!boardChannel.isTextBased() ||
								!boardChannel.isSendable()
							) {
								logger.error(
									`${board.name} channel not found, not a text channel or not sendable`,
								);
								continue;
							}

							let message: Message | null = null;
							try {
								message = await channel.messages.fetch(
									dbBoardMessage.originalMessageId.toString(),
								);
							} catch (error) {
								logger.error(
									`There was an error fetching the original ${board.name} message`,
									error,
								);
								continue;
							}

							const member = await getMember(message);
							if (!member) {
								logger.error(
									"Member not found for message %s",
									dbBoardMessage.originalMessageId,
								);
								continue;
							}

							let boardMessage: Message | null;
							try {
								boardMessage = await boardChannel.messages.fetch(
									dbBoardMessage.starboardMessageId.toString(),
								);
							} catch (error) {
								logger.error(`Error fetching ${board.name} message`, error);
								continue;
							}

							const effectiveStarCount = getDisplayCountForBoard(
								message,
								board,
							);
							const contentStarCount = getContentCountForBoard(message, board);
							const boardMessageContent =
								await createStarboardMessageFromMessage(
									message,
									member,
									effectiveStarCount,
									board.config,
									contentStarCount,
								);
							if (boardMessage.content !== boardMessageContent.content) {
								await boardMessage.edit(boardMessageContent);
								logger.info(
									`${board.name} message %s for message %s has been updated`,
									dbBoardMessage.starboardMessageId,
									dbBoardMessage.originalMessageId,
								);
							}

							logger.info(
								`${board.name} message %s for message %s has been checked`,
								dbBoardMessage.starboardMessageId,
								dbBoardMessage.originalMessageId,
							);

							await new Promise((resolve) => setTimeout(resolve, 1000));
						}
					}
				} finally {
					isRunningStarboardCheck = false;
				}
			},
		);
	},

	async messageReactionAdd(_, reaction) {
		if (reaction.partial) {
			try {
				await reaction.fetch();
			} catch (error) {
				logger.error(
					"Board: Something went wrong when fetching the reaction",
					error,
				);
				return;
			}
		}

		let message = reaction.message;
		if (message.partial) {
			try {
				message = await message.fetch();
			} catch (error) {
				logger.error(
					"Board: Something went wrong when fetching the message",
					error,
				);
				return;
			}
		}

		if (!message.inGuild() || message.author.bot || message.author.system) {
			return;
		}

		if (isBoardChannel(message.channel.id)) {
			return;
		}

		const board = getBoardForReaction(reaction.emoji.name, reaction.emoji.id);
		if (!board) {
			return;
		}

		if (isChannelBlacklisted(message.channel, board)) {
			return;
		}

		debounceStarboardReaction(board.key, message.id, true, async () => {
			reaction = await reaction.fetch();
			const refreshedMessage = await message.fetch();
			if (board.key === "antiStarboard") {
				await syncStarboardMessageScore(refreshedMessage);
			}

			const count = getThresholdReactionCount(
				refreshedMessage,
				board.config.emojiId,
				reaction.count,
			);
			if (count < board.config.threshold) {
				logger.debug(
					`Skipping ${board.name} post for message ${refreshedMessage.id}: ${count}/${board.config.threshold} reactions`,
				);
				return;
			}

			const boardChannel = await refreshedMessage.guild.channels.fetch(
				board.config.channel,
			);
			if (!boardChannel?.isTextBased() || !boardChannel.isSendable()) {
				logger.error(
					`${board.name} channel not found, not a text channel or not sendable`,
				);
				return;
			}

			const existingBoardMessage = await board.getMessageForOriginalMessageId(
				refreshedMessage.id,
			);
			try {
				const member = await getMember(refreshedMessage);
				if (!member) {
					logger.info(
						"Member not found for reaction message id %s, skipping",
						refreshedMessage.id,
					);
					return;
				}

				const displayCount = getDisplayCountForBoard(refreshedMessage, board);
				const contentCount = getContentCountForBoard(refreshedMessage, board);

				if (existingBoardMessage) {
					await updateBoardMessage(
						board,
						boardChannel,
						existingBoardMessage,
						refreshedMessage,
						member,
						displayCount,
						contentCount,
					);
					return;
				}

				const boardMessageContent = await createStarboardMessageFromMessage(
					refreshedMessage,
					member,
					displayCount,
					board.config,
					contentCount,
				);

				const boardMessage = await boardChannel.send({
					...boardMessageContent,
					allowedMentions: {
						parse: [],
					},
				});

				await board.createMessage(
					refreshedMessage.id,
					refreshedMessage.channelId,
					boardMessage.id,
				);

				if (board.grantReputation) {
					try {
						await grantReputation(
							BigInt(refreshedMessage.author.id),
							ReputationEventType.STARBOARD_MESSAGE,
							BigInt(refreshedMessage.author.id),
							`Message reached starboard with ${displayCount} stars`,
						);
						logger.debug(
							`Granted starboard reputation to user ${refreshedMessage.author.id}`,
						);
					} catch (error) {
						logger.error("Failed to grant starboard reputation", error);
					}
				}
			} catch (error) {
				logger.error(`Error sending ${board.name} message`, error);
			}
		});
	},

	async messageReactionRemove(_, reaction) {
		if (reaction.partial) {
			try {
				await reaction.fetch();
			} catch (error) {
				logger.error(
					"Board: Something went wrong when fetching the reaction",
					error,
				);
				return;
			}
		}

		let message = reaction.message;
		if (message.partial) {
			try {
				message = await message.fetch();
			} catch (error) {
				logger.error(
					"Board: Something went wrong when fetching the message",
					error,
				);
				return;
			}
		}

		if (!message.inGuild() || message.author.bot || message.author.system) {
			return;
		}

		if (isBoardChannel(message.channel.id)) {
			return;
		}

		const board = getBoardForReaction(reaction.emoji.name, reaction.emoji.id);
		if (!board) {
			return;
		}

		if (isChannelBlacklisted(message.channel, board)) {
			return;
		}

		debounceStarboardReaction(board.key, message.id, false, async () => {
			reaction = await reaction.fetch();
			const refreshedMessage = await message.fetch();
			if (board.key === "antiStarboard") {
				await syncStarboardMessageScore(refreshedMessage);
			}

			const existingBoardMessage = await board.getMessageForOriginalMessageId(
				refreshedMessage.id,
			);
			if (!existingBoardMessage) {
				return;
			}

			try {
				const member = await getMember(refreshedMessage);
				if (!member) {
					logger.info(
						"Member not found for reaction message id: %s",
						refreshedMessage.id,
					);
					return;
				}

				const boardChannel = await refreshedMessage.guild.channels.fetch(
					board.config.channel,
				);
				if (!boardChannel?.isTextBased() || !boardChannel.isSendable()) {
					logger.error(
						`${board.name} channel not found, not a text channel or not sendable`,
					);
					return;
				}

				await updateBoardMessage(
					board,
					boardChannel,
					existingBoardMessage,
					refreshedMessage,
					member,
					getDisplayCountForBoard(refreshedMessage, board),
					getContentCountForBoard(refreshedMessage, board),
				);
			} catch (error) {
				logger.error(`Error updating ${board.name} message`, error);
			}
		});
	},
};

async function syncStarboardMessageScore(message: Message<true>) {
	const starboard = getBoardByKey("starboard");
	if (!starboard) {
		return;
	}

	const existingStarboardMessage =
		await starboard.getMessageForOriginalMessageId(message.id);
	if (!existingStarboardMessage) {
		return;
	}

	const member = await getMember(message);
	if (!member) {
		logger.info(
			"Member not found while syncing starboard score for message id %s",
			message.id,
		);
		return;
	}

	const boardChannel = await message.guild.channels.fetch(
		starboard.config.channel,
	);
	if (!boardChannel?.isTextBased() || !boardChannel.isSendable()) {
		logger.error(
			"starboard channel not found, not a text channel or not sendable",
		);
		return;
	}

	await updateBoardMessage(
		starboard,
		boardChannel,
		existingStarboardMessage,
		message,
		member,
		getDisplayCountForBoard(message, starboard),
		getContentCountForBoard(message, starboard),
	);
}

async function updateBoardMessage(
	board: BoardDefinition,
	boardChannel: SendableChannels,
	boardMessageEntity: BoardMessageRecord,
	reactionMessage: Message<true>,
	member: GuildMember,
	starCount: number,
	contentStarCount: number,
) {
	try {
		let boardMessage: Message | null;
		try {
			boardMessage = await boardChannel.messages.fetch(
				boardMessageEntity.starboardMessageId.toString(),
			);
		} catch (error) {
			boardMessage = null;
			logger.error(`Error fetching the ${board.name} message`, error);
		}

		if (!boardMessage) {
			return;
		}

		const boardMessageFromMessage = await createStarboardMessageFromMessage(
			reactionMessage,
			member,
			starCount,
			board.config,
			contentStarCount,
		);
		await boardMessage.edit(boardMessageFromMessage);
	} catch (error) {
		logger.error(`Error updating the ${board.name} message`, error);
	}
}
