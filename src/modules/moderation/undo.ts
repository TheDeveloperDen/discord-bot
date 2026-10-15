/**
 * Manages undoing various moderation actions
 */
import {
	type Guild,
	type GuildMember,
	RESTJSONErrorCodes,
	type User,
} from "discord.js";
import { Warning } from "../../store/models/Warning.js";
import { fakeMention } from "../../util/users.js";
import { checkCanTimeout } from "../core/timeout.command.js";
import { dmModerationTarget, dmWarning, logModerationAction } from "./logs.js";
import { getActiveTempBanModAction } from "./tempBan.js";

/**
 * The outcome of undoing a moderation action, shared by the slash commands and the mod log's undo buttons.
 * `alreadyDone` means there was nothing left to undo (e.g. someone else got there first), so the log card can
 * still be marked as undone.
 */
export type UndoResult =
	| { ok: true; message: string }
	| { ok: false; message: string; alreadyDone?: boolean };

export const MAX_PARDON_REASON_LENGTH = 500;

const discordErrorCode = (error: unknown) =>
	(error as { code?: unknown } | null)?.code;

/** Unbans a user, cancelling any tempban so it doesn't "expire" later */
export async function unbanUser(
	guild: Guild,
	moderator: User,
	userId: string,
	reason?: string,
): Promise<UndoResult> {
	try {
		await guild.bans.remove(userId, reason);
	} catch (error) {
		const code = discordErrorCode(error);
		if (code === RESTJSONErrorCodes.UnknownBan) {
			return { ok: false, alreadyDone: true, message: "They aren't banned." };
		}
		if (code === RESTJSONErrorCodes.UnknownUser) {
			return { ok: false, message: "There's no user with that ID." };
		}
		throw error;
	}

	const tempBan = await getActiveTempBanModAction(BigInt(userId));
	if (tempBan) await tempBan.destroy();

	const user = await guild.client.users.fetch(userId).catch(() => null);
	await logModerationAction(guild.client, {
		kind: "Unban",
		target: userId,
		moderator,
		reason,
	});
	return {
		ok: true,
		message: `Unbanned ${user ? fakeMention(user) : "user"} (${userId})`,
	};
}

/** Pardons an active warning, DMs its recipient and logs it */
export async function pardonWarning(
	guild: Guild,
	moderator: User,
	warningId: number,
	rawReason: string,
): Promise<UndoResult> {
	const reason = rawReason.trim();
	if (reason.length === 0) {
		return { ok: false, message: "Pardon reason cannot be empty." };
	}
	if (reason.length > MAX_PARDON_REASON_LENGTH) {
		return {
			ok: false,
			message: `Pardon reason must be under ${MAX_PARDON_REASON_LENGTH} characters.`,
		};
	}

	// only pardons a warning that's still active, so two moderators can't both pardon it
	const [affectedRows] = await Warning.update(
		{
			pardoned: true,
			pardonedBy: BigInt(moderator.id),
			pardonReason: reason,
		},
		{ where: { id: warningId, pardoned: false, expired: false } },
	);

	const warning = await Warning.findByPk(warningId);
	if (affectedRows === 0) {
		if (!warning) {
			return { ok: false, message: `Warning #${warningId} not found.` };
		}
		const state = warning.pardoned ? "been pardoned" : "expired";
		return {
			ok: false,
			alreadyDone: warning.pardoned || warning.expired,
			message:
				warning.pardoned || warning.expired
					? `Warning #${warningId} has already ${state}.`
					: `Could not pardon warning #${warningId}. Please try again.`,
		};
	}
	if (!warning) {
		// extremely unlikely: the warning was deleted between the update and the fetch
		return {
			ok: true,
			message: `Warning #${warningId} was pardoned but could not be found for logging.`,
		};
	}

	const target = await guild.client.users
		.fetch(warning.userId.toString())
		.catch(() => null);
	let dmSent = false;
	if (target) {
		dmSent = await dmModerationTarget(
			target,
			`Your warning #${warningId} in **${guild.name}** has been pardoned.\n` +
				`**Reason:** ${reason}`,
		);
		await logModerationAction(guild.client, {
			kind: "WarningPardoned",
			moderator,
			target,
			warningId: warning.id,
			reason,
			dmSent,
		});
	}
	return {
		ok: true,
		message:
			`Pardoned warning #${warningId}` +
			(target ? ` for ${fakeMention(target)}` : "") +
			`\n**Reason:** ${reason}` +
			dmWarning(dmSent),
	};
}

/** Ends a member's timeout early, with the same role checks as `/timeout` */
export async function removeTimeout(
	moderator: GuildMember,
	targetId: string,
	reason?: string,
): Promise<UndoResult> {
	const guild = moderator.guild;
	const target = await guild.members.fetch(targetId).catch((error) => {
		if (discordErrorCode(error) === RESTJSONErrorCodes.UnknownMember) {
			return null;
		}
		throw error;
	});
	if (!target) {
		// leaving the server doesn't end a timeout, but there's nothing to do until they rejoin
		return { ok: false, message: "That user isn't in this server." };
	}
	if (!target.isCommunicationDisabled()) {
		return {
			ok: false,
			alreadyDone: true,
			message: "They aren't timed out any more.",
		};
	}
	const refusal = checkCanTimeout(moderator, target, guild.ownerId);
	if (refusal != null) return { ok: false, message: refusal };

	await target.timeout(null, reason);
	const dmSent = await dmModerationTarget(
		target.user,
		`Your timeout in **${guild.name}** has been removed.`,
	);
	await logModerationAction(guild.client, {
		kind: "TimeoutRemoved",
		moderator: moderator.user,
		target: target.user,
		reason,
		dmSent,
	});
	return {
		ok: true,
		message: `Removed the timeout of ${fakeMention(target.user)}${dmWarning(dmSent)}`,
	};
}
