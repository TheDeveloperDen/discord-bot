import * as Sentry from "@sentry/bun";
import type { Message, Snowflake } from "discord.js";
import ExpiryMap from "expiry-map";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import type { EventListener } from "../module.js";
import {
	type CachedMessage,
	logBulkDeletedMessages,
	logDeletedMessage,
} from "./logs.js";

// Configurable TTL - default 24 hours
const CACHE_TTL_MS =
	config.deletedMessageLog?.cacheTtlMs ?? 1000 * 60 * 60 * 24;

const messageCache = new ExpiryMap<Snowflake, CachedMessage>(CACHE_TTL_MS);

// Auto-excluded mod channels
const modChannels = new Set([
	config.channels.modLog,
	config.channels.auditLog,
	config.modmail.channel,
]);

function isExcludedChannel(channelId: Snowflake): boolean {
	const additionalExcluded = config.deletedMessageLog?.excludedChannels ?? [];
	return modChannels.has(channelId) || additionalExcluded.includes(channelId);
}

function cacheMessage(message: Message): void {
	if (
		message.author.bot ||
		!message.inGuild() ||
		isExcludedChannel(message.channelId)
	)
		return;

	messageCache.set(message.id, {
		id: message.id,
		content: message.content,
		authorId: message.author.id,
		authorTag: message.author.tag,
		channelId: message.channelId,
		createdTimestamp: message.createdTimestamp,
		attachmentUrls: message.attachments.map((a) => a.url),
	});
}

export const DeletedMessagesListener: EventListener = {
	messageCreate(_, message) {
		if (!message.inGuild()) return;
		cacheMessage(message);
	},

	messageUpdate(_, _oldMessage, newMessage) {
		if (!newMessage.inGuild()) return;
		if (newMessage.partial) return;
		cacheMessage(newMessage);
	},

	async messageDelete(client, message) {
		try {
			if (isExcludedChannel(message.channelId)) return;

			const cached = messageCache.get(message.id);
			if (!cached) {
				logger.debug(`Deleted message ${message.id} not in cache`);
				return;
			}

			await logDeletedMessage(client, cached);
			messageCache.delete(message.id);
		} catch (error) {
			logger.error("Failed to log deleted message:", error);
			Sentry.captureException(error);
		}
	},

	async messageDeleteBulk(client, messages, channel) {
		try {
			if (isExcludedChannel(channel.id)) return;

			const cachedMessages: CachedMessage[] = [];
			for (const [id] of messages) {
				const cached = messageCache.get(id);
				if (cached) {
					cachedMessages.push(cached);
					messageCache.delete(id);
				}
			}

			if (cachedMessages.length === 0) {
				logger.debug(`Bulk deletion in ${channel.id} - no messages in cache`);
				return;
			}

			await logBulkDeletedMessages(client, cachedMessages, channel.id);
		} catch (error) {
			logger.error("Failed to log bulk deleted messages:", error);
			Sentry.captureException(error);
		}
	},
};
