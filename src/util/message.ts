import { Collection, type Message, type TextBasedChannel } from "discord.js";
import { logger } from "../logging.js";

/**
 * Fetches all messages from a channel with rate limit protection and pagination
 * @param channel The channel to fetch messages from
 * @param maxMessages Maximum number of messages to fetch (default: 10000, -1 = fetch all available)
 * @param delayMs Delay between requests in milliseconds (default: 500ms)
 * @param filter Optional filter function to apply to messages
 * @returns Collection of all messages
 */
export async function fetchAllMessages(
	channel: TextBasedChannel,
	maxMessages: number = 10000,
	delayMs: number = 500,
	filter: (message: Message) => boolean = () => true,
): Promise<Collection<string, Message>> {
	const allMessages = new Map<string, Message>();
	let lastMessageId: string | undefined;
	let totalFetched = 0;
	const fetchAll = maxMessages === -1;

	try {
		while (fetchAll || totalFetched < maxMessages) {
			// Calculate remaining messages to fetch
			const remaining = fetchAll ? 100 : maxMessages - totalFetched;
			const limit = Math.min(100, remaining); // Discord API limit is 100 per request

			logger.debug(
				`Fetching ${limit} messages... (Total: ${totalFetched}${fetchAll ? "" : `/${maxMessages}`})`,
			);

			// Fetch messages with pagination
			const fetchOptions: { limit: number; before?: string } = { limit };
			if (lastMessageId) {
				fetchOptions.before = lastMessageId;
			}

			const messages = await channel.messages.fetch(fetchOptions);

			// If no messages returned, we've reached the end
			if (messages.size === 0) {
				logger.info("No more messages to fetch");
				break;
			}
			// Add messages to our collection
			for (const [id, message] of messages) {
				if (!filter(message)) continue;
				allMessages.set(id, message);
			}

			totalFetched += messages.size;
			logger.info(`Fetched ${messages.size} messages (Total: ${totalFetched})`);

			// Update lastMessageId for pagination
			const messagesArray = Array.from(messages.values());
			lastMessageId = messagesArray[messagesArray.length - 1]?.id;

			// If we fetched less than requested, we've reached the end
			if (messages.size < limit) {
				console.info("Reached end of channel messages");
				break;
			}

			// Rate limit protection - wait before next request
			if ((fetchAll || totalFetched < maxMessages) && delayMs > 0) {
				logger.info(`Waiting ${delayMs}ms before next request...`);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		logger.info(`Successfully fetched ${allMessages.size} total messages`);
		return new Collection(allMessages);
	} catch (error) {
		logger.error("Error fetching messages:", error);

		// Return what we have so far instead of failing completely
		if (allMessages.size > 0) {
			logger.error(
				`Returning ${allMessages.size} messages fetched before error`,
			);
			return new Collection(allMessages);
		}

		throw error;
	}
}

/**
 * Fetches all messages with exponential backoff retry logic
 * @param channel The channel to fetch messages from
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @param maxMessages Maximum number of messages to fetch (default: 10000)
 * @param filter Optional filter function to apply to messages
 * @returns Collection of all messages
 */
export async function fetchAllMessagesWithRetry(
	channel: TextBasedChannel,
	maxRetries: number = 3,
	maxMessages: number = 10000,
	filter: (message: Message) => boolean = () => true,
): Promise<Collection<string, Message>> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			logger.info(`Fetch attempt ${attempt}/${maxRetries}`);

			// Increase delay with each retry attempt
			const delayMs = Math.min(500 * attempt, 2000);

			return await fetchAllMessages(channel, maxMessages, delayMs, filter);
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			logger.error(`Attempt ${attempt} failed:`, lastError.message);

			if (attempt < maxRetries) {
				// Exponential backoff: wait longer after each failed attempt
				const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 10000);
				logger.error(`Retrying in ${backoffMs}ms...`);
				await new Promise((resolve) => setTimeout(resolve, backoffMs));
			}
		}
	}

	throw new Error(
		`Failed to fetch messages after ${maxRetries} attempts. Last error: ${lastError?.message}`,
	);
}
