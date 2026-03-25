import type { Message } from "discord.js";

export interface ReactionStub {
	emoji: {
		name: string | null;
		id: string | null;
	};
	count: number | null;
}

const buildReactionsCache = (reactions: ReactionStub[]) => ({
	cache: {
		find: (
			predicate: (reaction: ReactionStub) => boolean,
		): ReactionStub | undefined => reactions.find(predicate),
	},
});

export const createMessageWithReactions = (
	reactions: ReactionStub[],
): Message => {
	return {
		reactions: buildReactionsCache(reactions),
	} as unknown as Message;
};

export const createMessageWithUrlAndReactions = (
	url: string,
	reactions: ReactionStub[],
): Pick<Message, "url" | "reactions"> => {
	return {
		url,
		reactions: buildReactionsCache(reactions),
	} as Pick<Message, "url" | "reactions">;
};
