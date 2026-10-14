import {
	type Channel,
	type Client,
	type GuildMember,
	type Message,
	RESTJSONErrorCodes,
	type SendableChannels,
	type Snowflake,
} from "discord.js";
import * as schedule from "node-schedule";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { AntiStarboardMessage } from "../../store/models/AntiStarboardMessage.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { ReputationEventType } from "../../store/models/ReputationEvent.js";
import { StarboardMessage } from "../../store/models/StarboardMessage.js";
import { getMember } from "../../util/member.js";
import { awaitTimeout } from "../../util/timeouts.js";
import { notifyMultipleAchievements } from "../achievements/achievementNotifier.js";
import { checkAndAwardAchievements } from "../achievements/achievementService.js";
import { grantReputation } from "../moderation/reputation.service.js";
import type { EventListener } from "../module.js";
import {
	copyForModLog,
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
		schedule.scheduleJob({ hour: 0, minute: 0, second: 0 }, () =>
			refreshBoards(client),
		);
	},

	async messageDelete(client, message) {
		await removeBoardPostsFor(client, [message.id]);
	},

	async messageDeleteBulk(client, messages) {
		await removeBoardPostsFor(client, [...messages.keys()]);
	},

	async messageReactionAdd(client, reaction) {
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
			if (existingBoardMessage?.removedAt) return;
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

				if (board.key === "starboard") {
					try {
						const ddUser = await getOrCreateUserById(
							BigInt(refreshedMessage.author.id),
						);
						ddUser.starboardCount = (ddUser.starboardCount ?? 0) + 1;
						await ddUser.save();

						const newAchievements = await checkAndAwardAchievements(
							ddUser,
							{ type: "starboard", event: "starboard_reached" },
							{ starboardCount: ddUser.starboardCount },
						);

						if (newAchievements.length > 0) {
							const member = await refreshedMessage.guild?.members.fetch(
								refreshedMessage.author.id,
							);
							if (member) {
								await notifyMultipleAchievements(
									client,
									member,
									newAchievements.map((a) => a.definition),
									refreshedMessage.channel,
								);
							}
						}
					} catch (error) {
						logger.error("Failed to check starboard achievements", error);
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
			if (!existingBoardMessage || existingBoardMessage.removedAt) {
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
	if (!existingStarboardMessage || existingStarboardMessage.removedAt) {
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
		await boardMessage.edit({ ...boardMessageFromMessage, attachments: [] });
	} catch (error) {
		logger.error(`Error updating the ${board.name} message`, error);
	}
}

let isRefreshingBoards = false;

/**
 * Re-renders every board post from its original message, so star counts stay accurate and UI changes reach old
 * posts. A post whose original was deleted is moved to the mod log.
 */
export async function refreshBoards(client: Client) {
	if (isRefreshingBoards) return;
	isRefreshingBoards = true;
	try {
		for (const board of boardDefinitions) {
			logger.info(`Refreshing ${board.name} posts...`);
			const boardChannel = await client.channels.fetch(board.config.channel);
			if (!boardChannel?.isTextBased() || !boardChannel.isSendable()) {
				logger.error(
					`${board.name} channel not found, not a text channel or not sendable`,
				);
				continue;
			}
			const records = await board.model.findAll({ where: { removedAt: null } });
			for (const record of records) {
				let message: Message;
				try {
					const channel = await client.channels.fetch(
						record.originalMessageChannelId.toString(),
					);
					if (!channel?.isTextBased() || isChannelBlacklisted(channel, board)) {
						continue;
					}
					message = await channel.messages.fetch(
						record.originalMessageId.toString(),
					);
				} catch (error) {
					if (isGone(error)) {
						await removeBoardPost(client, board, record);
					} else {
						logger.error(
							`Couldn't fetch the original of ${board.name} post ${record.starboardMessageId}`,
							error,
						);
					}
					continue;
				}
				if (!message.inGuild()) continue;

				const member = await getMember(message);
				if (!member) {
					logger.error(
						"Member not found for message %s",
						record.originalMessageId,
					);
					continue;
				}
				await updateBoardMessage(
					board,
					boardChannel,
					record,
					message,
					member,
					getDisplayCountForBoard(message, board),
					getContentCountForBoard(message, board),
				);
				// spreads the edits out, so a big board doesn't expend our rate limits
				await awaitTimeout(1000);
			}
			logger.info(`Refreshed ${records.length} ${board.name} posts`);
		}
	} catch (error) {
		logger.error("Failed to refresh board posts", error);
	} finally {
		isRefreshingBoards = false;
	}
}

/** Moves the board posts of deleted original messages to the mod log */
async function removeBoardPostsFor(client: Client, messageIds: Snowflake[]) {
	for (const id of messageIds) {
		for (const board of boardDefinitions) {
			const record = await board.getMessageForOriginalMessageId(id);
			if (record && !record.removedAt) {
				await removeBoardPost(client, board, record);
			}
		}
	}
}

/**
 * Takes a post off the board once its original message is deleted,
 * keeping a copy in the mod log in case a moderator needs it, and marking the {@link BoardDefinition} as removed.
 */
async function removeBoardPost(
	client: Client,
	board: BoardDefinition,
	record: BoardMessageRecord,
) {
	if (record.removedAt) return;
	const boardChannel = await client.channels.fetch(board.config.channel);
	if (!boardChannel?.isTextBased()) return;

	let post: Message | null = null;
	try {
		post = await boardChannel.messages.fetch(
			record.starboardMessageId.toString(),
		);
	} catch (error) {
		// already gone, so there's nothing to copy
		if (!isGone(error)) throw error;
	}
	if (post) {
		const modLog = await client.channels.fetch(config.channels.modLog);
		if (!modLog?.isSendable()) {
			throw new Error("The mod log channel isn't sendable");
		}
		// copy before deleting so a failed copy never loses the post
		await modLog.send(copyForModLog(post, board.name));
		await post.delete();
	}
	await record.update({ removedAt: new Date() });
	logger.info(
		`Removed ${board.name} post ${record.starboardMessageId}: its original message ${record.originalMessageId} was deleted`,
	);
}

/** Discord's errors for a message or channel that no longer exists, as opposed to e.g. missing permissions */
function isGone(error: unknown): boolean {
	const code = (error as { code?: unknown } | null)?.code;
	return (
		code === RESTJSONErrorCodes.UnknownMessage ||
		code === RESTJSONErrorCodes.UnknownChannel
	);
}
