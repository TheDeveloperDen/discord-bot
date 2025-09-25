import * as Sentry from "@sentry/bun";
import type { GuildMember, Message } from "discord.js";
import { logger } from "../../logging.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { getMember } from "../../util/member.js";
import { actualMention, isSpecialUser } from "../../util/users.js";
import type { EventListener } from "../module.js";
import { getTierByLevel } from "../xp/xpForMessage.util.js";
import { logModerationAction } from "./logs.js";

const invitePatterns = [
	/discord\.gg\/[a-zA-Z0-9]+/gi,
	/discordapp\.com\/invite\/[a-zA-Z0-9]+/gi,
	/discord\.com\/invite\/[a-zA-Z0-9]+/gi,
	/(^| )\.gg\/[a-zA-Z0-9]+/gi,
];

const whitelistDomains: string[] = []; // For any .gg domains that are not discord.gg

const isAllowedToSendDiscordInvites = async (member: GuildMember) => {
	const ddUser = await getOrCreateUserById(BigInt(member.id));
	return getTierByLevel(ddUser.level) >= 2;
};

function parseInvites(message: Message<true>) {
	// Check if message contains any Discord invite
	const matches = invitePatterns
		.map((pattern) => message.content.match(pattern))
		.filter((match) => match != null && match.length > 0)
		// biome-ignore lint/style/noNonNullAssertion: null checked
		.map((match) => match![0])
		.filter(
			(match) => !whitelistDomains.some((domain) => match.includes(domain)),
		);

	const hasInvite = matches.length > 0;
	return { matches, hasInvite };
}

async function sendAuditMessage(
	message: Message<true>,
	member: GuildMember,
	matches: string[],
	wasEdit: boolean,
) {
	await logModerationAction(message.client, {
		kind: "InviteDeleted",
		target: member.user,
		messageId: message.id,
		messageCreatedTimestamp: message.createdTimestamp,
		edited: wasEdit,
		matches,
	});
}

const noInvitesAllowedMessage = (member: GuildMember) =>
	`${actualMention(member)}, only Users with Tier 2 or over are allowed to send Discord invites.\nPlease remove the invite before sending it again.\nThank you!`;

async function handleInvite(
	message: Message<true>,
	member: GuildMember,
	matches: string[],
	wasEdit: boolean,
) {
	try {
		await message.delete();

		const warningMessage = await message.channel.send({
			content: noInvitesAllowedMessage(member),
		});

		setTimeout(() => {
			warningMessage.delete().catch(() => {});
		}, 10000);

		await sendAuditMessage(message, member, matches, wasEdit);
	} catch (error) {
		logger.error("Failed to delete message with Discord invite:", error);
		Sentry.captureException(error);
	}
}

export const InviteListeners: EventListener[] = [
	{
		async messageCreate(_, message) {
			if (message.author.bot || !message.inGuild()) return;
			const member = await getMember(message);
			if (!member || isSpecialUser(member)) return;
			if (await isAllowedToSendDiscordInvites(member)) return;

			const { matches, hasInvite } = parseInvites(message);

			if (hasInvite) {
				await handleInvite(message, member, matches, false);
			}
		},
		async messageUpdate(_, _oldMessage, message) {
			if (message.author.bot || !message.inGuild()) return;
			const member = await getMember(message);
			if (!member || isSpecialUser(member)) return;
			if (await isAllowedToSendDiscordInvites(member)) return;

			const { matches, hasInvite } = parseInvites(message);

			if (hasInvite) {
				await handleInvite(message, member, matches, true);
			}
		},
	},
];
