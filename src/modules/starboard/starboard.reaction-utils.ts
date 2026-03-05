import type { Message } from "discord.js";

type ReactionMessage = Pick<Message, "reactions">;

export const normalizeEmojiValue = (emoji: string): string => {
	return emoji.normalize("NFKC").replace(/[\uFE0E\uFE0F]/gu, "");
};

const extractCustomEmojiId = (emojiConfig: string): string | null => {
	const match = emojiConfig.match(/^<a?:\w+:(\d+)>$/u);
	return match?.[1] ?? null;
};

export const getConfiguredEmojiId = (emojiConfig: string): string => {
	return extractCustomEmojiId(emojiConfig) ?? emojiConfig;
};

export const matchesConfiguredEmoji = (
	emojiName: string | null,
	emojiId: string | null,
	emojiConfig: string,
): boolean => {
	const configuredEmojiId = getConfiguredEmojiId(emojiConfig);
	const normalizedEmojiName = emojiName
		? normalizeEmojiValue(emojiName)
		: emojiName;
	const normalizedEmojiConfig = normalizeEmojiValue(emojiConfig);
	return (
		normalizedEmojiName === normalizedEmojiConfig ||
		emojiId === configuredEmojiId
	);
};

export const getReactionCountForEmoji = (
	message: ReactionMessage,
	emojiConfig: string,
): number => {
	const configuredEmojiId = getConfiguredEmojiId(emojiConfig);
	const normalizedEmojiConfig = normalizeEmojiValue(emojiConfig);
	const reaction = message.reactions.cache.find(
		(item) =>
			(item.emoji.name &&
				normalizeEmojiValue(item.emoji.name) === normalizedEmojiConfig) ||
			item.emoji.id === configuredEmojiId,
	);
	return reaction?.count ?? 0;
};

export const getThresholdReactionCount = (
	message: ReactionMessage,
	emojiConfig: string,
	eventReactionCount: number | null,
): number => {
	return Math.max(
		getReactionCountForEmoji(message, emojiConfig),
		eventReactionCount ?? 0,
	);
};
