const CUSTOM_EMOJI_ALIAS_PATTERN = /^a?:[A-Za-z0-9_]+:$/;

/**
 * Joins whole lines until `maxLength` is reached, ending with "…and N more" if some had to be left out,
 * so a long list stays inside a message's total text limit without cutting an entry in half.
 * A single line longer than `maxLength` is truncated.
 */
export function fitLines(
	lines: string[],
	maxLength: number,
	separator = "\n",
): string {
	const kept: string[] = [];
	let length = 0;
	for (const [i, line] of lines.entries()) {
		const left = lines.length - i - 1;
		// leaves room for the "…and N more" line, unless this is the last one
		const reserve = left > 0 ? `${separator}…and ${left} more`.length : 0;
		const next =
			length + (kept.length > 0 ? separator.length : 0) + line.length;
		if (next + reserve > maxLength) {
			if (kept.length === 0) {
				return `${line.slice(0, Math.max(0, maxLength - 1))}…`;
			}
			return `${kept.join(separator)}${separator}…and ${lines.length - i} more`;
		}
		kept.push(line);
		length = next;
	}
	return kept.join(separator);
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
