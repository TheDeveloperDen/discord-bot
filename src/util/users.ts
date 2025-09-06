import {
	type Client,
	type GuildMember,
	Message,
	type PartialGuildMember,
	User,
	type UserMention,
	type UserResolvable,
} from "discord.js";
import { config } from "../Config.js";

export const userShouldBePinged = (
	user: GuildMember | PartialGuildMember,
): boolean => !user.roles.cache.has(config.roles.noPing);

export const fakeMention = (user: User): string =>
	user.discriminator === "0"
		? user.username
		: `${user.username}#${user.discriminator}`;

export const mentionIfPingable = (
	user: GuildMember | User | PartialGuildMember,
): string => {
	if (user instanceof User) {
		// we don't have the roles, so we can't check if they have the noPing role
		return actualMention(user);
	} else {
		return userShouldBePinged(user)
			? actualMention(user)
			: fakeMention(user.user);
	}
};

export type UserMentionable = UserResolvable | bigint | PartialGuildMember;

export function actualMention(user: UserMentionable): UserMention {
	if (user instanceof User) {
		return `<@${user.id}>`;
	}
	if (user instanceof Message) {
		return `<@${user.author.id}>`;
	}
	if (typeof user === "object" && "id" in user) {
		return actualMention(user.id);
	}
	// noinspection SuspiciousTypeOfGuard i think you are incorrect
	if (typeof user === "string" || typeof user === "bigint") {
		return `<@${user}>`;
	}

	function unreachable(x: never): never {
		throw new Error(
			`This case should have been impossible to reach: ${JSON.stringify(x)}`,
		);
	}

	return unreachable(user); // never
}

export const actualMentionById = (id: bigint): string => `<@${id}>`;

export const mentionWithNoPingMessage = (user: GuildMember): string =>
	userShouldBePinged(user)
		? `<@${user.id}> (Don't want to be pinged? </no-ping:1300906483403325490>)`
		: fakeMention(user.user);

export const isSpecialUser = (user: GuildMember): boolean =>
	user.premiumSinceTimestamp != null ||
	user.roles.cache.has(config.roles.staff) ||
	user.roles.cache.has(config.roles.notable ?? "") ||
	user.roles.cache.has("1185946490984738938");

export const safelyFetchUser = async (
	client: Client,
	userId: string,
): Promise<User | null> => {
	try {
		return await client.users.fetch(userId);
	} catch (error) {
		// Optionally log the error
		console.warn(`Could not fetch user ${userId}:`, error);
		return null;
	}
};
