export const EMBED_FIELD_VALUE_LIMIT = 1024;
const CUSTOM_EMOJI_ALIAS_PATTERN = /^a?:[A-Za-z0-9_]+:$/;

export function chunkEmbedFieldValues(
	lines: string[],
	maxLength = EMBED_FIELD_VALUE_LIMIT,
): string[] {
	if (lines.length === 0) return [];

	const chunks: string[] = [];
	let current = "";

	for (const line of lines) {
		const normalizedLine =
			line.length <= maxLength
				? line
				: `${line.slice(0, Math.max(0, maxLength - 3))}...`;

		if (current.length === 0) {
			current = normalizedLine;
			continue;
		}

		const candidate = `${current}\n\n${normalizedLine}`;
		if (candidate.length <= maxLength) {
			current = candidate;
			continue;
		}

		chunks.push(current);
		current = normalizedLine;
	}

	if (current.length > 0) {
		chunks.push(current);
	}

	return chunks;
}

function normalizeCustomEmojiName(emojiName: string): string {
	const trimmed = emojiName.trim();
	const withoutAnimatedPrefix = trimmed.replace(/^a:/, "");
	const withoutLeadingColon = withoutAnimatedPrefix.replace(/^:/, "");
	const withoutTrailingColon = withoutLeadingColon.replace(/:$/, "");
	return withoutTrailingColon || "custom_emoji";
}

function customEmojiAlias(emojiName: string): string {
	return `:${normalizeCustomEmojiName(emojiName)}:`;
}

function customEmojiImageUrl(emojiId: bigint): string {
	return `https://cdn.discordapp.com/emojis/${emojiId.toString()}.webp?size=32&quality=lossless`;
}

export interface EmojiDisplayOptions {
	canRenderCustomEmoji?: boolean;
}

export function formatEmojiForEmbed(
	emojiName: string,
	isCustomEmoji: boolean,
	emojiId: bigint | null,
	options: EmojiDisplayOptions = {},
): string {
	if (isCustomEmoji) {
		const normalizedName = normalizeCustomEmojiName(emojiName);
		const alias = `:${normalizedName}:`;
		if (emojiId && options.canRenderCustomEmoji !== false) {
			return `<:${normalizedName}:${emojiId.toString()}>`;
		}

		if (emojiId) {
			const imageUrl = customEmojiImageUrl(emojiId);
			return `\`${alias}\` ([image](${imageUrl}), external)`;
		}

		return `\`${alias}\` (external)`;
	}

	if (CUSTOM_EMOJI_ALIAS_PATTERN.test(emojiName)) {
		return `\`${customEmojiAlias(emojiName)}\` (external)`;
	}

	return emojiName;
}
