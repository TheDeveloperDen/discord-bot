import type { ColorResolvable, Message } from "discord.js";
import { config } from "../../Config.js";
import { getReactionCountForEmoji } from "./starboard.reaction-utils.js";

export interface StarboardContentRenderOptions {
	emojiId: string;
	threshold: number;
	color: ColorResolvable;
}

const getAntiStarHintForMessage = (
	message: Pick<Message, "reactions">,
	renderOptions: StarboardContentRenderOptions,
): string | null => {
	if (
		!config.antiStarboard ||
		renderOptions.emojiId !== config.starboard.emojiId
	) {
		return null;
	}

	const antiStarCount = getReactionCountForEmoji(
		message,
		config.antiStarboard.emojiId,
	);
	if (antiStarCount < 1) {
		return null;
	}

	return `(- ${config.antiStarboard.emojiId}: ${antiStarCount})`;
};

export const buildStarboardMessageContent = (
	message: Pick<Message, "url" | "reactions">,
	stars: number,
	renderOptions: StarboardContentRenderOptions,
): string => {
	const contentParts = [`${renderOptions.emojiId}: ${stars}`];
	const antiStarHint = getAntiStarHintForMessage(message, renderOptions);
	if (antiStarHint) {
		contentParts.push(antiStarHint);
	}
	contentParts.push("|", message.url);

	return contentParts.join(" ");
};
