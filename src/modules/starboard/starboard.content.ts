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

	return `${config.antiStarboard.emojiId} ${antiStarCount}`;
};

/** The post's score, e.g. `⭐ 5 | 👎 2`, with the anti-star count only on the starboard */
export const buildStarboardScore = (
	message: Pick<Message, "reactions">,
	stars: number,
	renderOptions: StarboardContentRenderOptions,
): string => {
	const antiStarHint = getAntiStarHintForMessage(message, renderOptions);
	const score = `${renderOptions.emojiId} ${stars}`;
	return antiStarHint ? `${score} | ${antiStarHint}` : score;
};
