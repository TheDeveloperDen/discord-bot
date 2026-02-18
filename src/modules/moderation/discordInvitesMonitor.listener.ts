import * as Sentry from "@sentry/bun";
import type { GuildMember, Message } from "discord.js";
import ExpiryMap from "expiry-map";
import { config } from "../../Config.js";
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

interface InviteViolation {
	count: number;
	channels: Set<string>;
}

const inviteViolationCache = new ExpiryMap<string, InviteViolation>(
	config.inviteSpam.violationWindowMs,
);

const isAllowedToSendDiscordInvites = async (member: GuildMember) => {
	const ddUser = await getOrCreateUserById(BigInt(member.id));
	return getTierByLevel(ddUser.level) >= 2;
};

const isSubjectToAutoban = (member: GuildMember): boolean => {
	if (config.inviteSpam.accountAgeDays === 0) return true;

	const joinedAt = member.joinedAt;
	if (!joinedAt) return true;

	const daysSinceJoin =
		(Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24);
	return daysSinceJoin < config.inviteSpam.accountAgeDays;
};

export function parseInvites(message: Message<true>) {
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

async function banForInviteSpam(
	message: Message<true>,
	member: GuildMember,
	violation: InviteViolation,
) {
	const triggerReason =
		violation.channels.size >= config.inviteSpam.maxChannels
			? "cross_channel"
			: "same_channel";

	try {
		await member
			.send(
				"You have been banned for spamming Discord invites. " +
					"If you believe this was a mistake, please contact a moderator.",
			)
			.catch(() => {});

		await message.guild.bans.create(member.user, {
			reason: `Auto-ban: Invite spam (${violation.count} violations across ${violation.channels.size} channel(s) in ${config.inviteSpam.violationWindowMs / 1000}s)`,
			deleteMessageSeconds: 604800,
		});

		await logModerationAction(message.client, {
			kind: "InviteSpamBan",
			target: member.user,
			violationCount: violation.count,
			channelCount: violation.channels.size,
			violationWindowMs: config.inviteSpam.violationWindowMs,
			triggerReason,
		});

		inviteViolationCache.delete(member.id);
	} catch (error) {
		logger.error("Failed to ban invite spammer:", error);
		Sentry.captureException(error);
	}
}

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

		const existing = inviteViolationCache.get(member.id);
		const violation: InviteViolation = existing ?? {
			count: 0,
			channels: new Set(),
		};
		violation.count++;
		violation.channels.add(message.channelId);
		inviteViolationCache.set(member.id, violation);

		const shouldBan =
			violation.count >= config.inviteSpam.maxViolations ||
			violation.channels.size >= config.inviteSpam.maxChannels;

		if (shouldBan && isSubjectToAutoban(member)) {
			await banForInviteSpam(message, member, violation);
		}
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
