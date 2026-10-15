import type { Client, GuildMember, TextChannel } from "discord.js";
import { Message, renderDiscordMessage } from "disjsx";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import type { DDUser } from "../../store/models/DDUser.js";
import { memberAuthor } from "../../ui/index.js";
import { modifyRoles } from "../../util/roles.js";
import {
	mentionWithNoPingMessage,
	userShouldBePinged,
} from "../../util/users.js";
import { xpForLevel } from "./levels.js";
import { LevelUpCard } from "./xp.cards.js";
import { tierRoleId } from "./xpForMessage.util.js";

/**
 * Level up a user as many times as they necessary,
 * sending a message if they level up at least once, and applying roles.
 *
 * Note that this function will not save the user to the database.
 * @param client discord client
 * @param user guild member
 * @param ddUser DDUser for the guild member
 */
export async function levelUp(
	client: Client,
	user: GuildMember,
	ddUser: DDUser,
) {
	const newLevel = levelForXp(ddUser.xp);
	logger.debug(
		`${ddUser.id} xp (${ddUser.xp}) should put them at level ${newLevel}`,
	);
	if (newLevel <= ddUser.level) {
		return;
	}
	logger.info(
		`${ddUser.id} xp (${ddUser.xp}) was enough to level up to ${newLevel} (${xpForLevel(
			newLevel,
		)})`,
	);
	const previousLevel = ddUser.level;
	ddUser.level = newLevel;
	logger.info(`${ddUser.id} leveling up to ${newLevel}`);
	await applyTierRoles(client, user, ddUser);
	await sendLevelUpMessage(client, user, ddUser, previousLevel);
}

export function levelForXp(xp: bigint) {
	let level = 0;
	while (xp >= xpForLevel(level + 1)) {
		level++;
	}
	return level;
}

export async function applyTierRoles(
	client: Client,
	user: GuildMember,
	ddUser: DDUser,
) {
	const tier = tierRoleId(ddUser.level);
	await modifyRoles(client, user, {
		toAdd: [tier],
		toRemove: config.roles.tiers.filter((it) => it !== tier),
	});
}

async function sendLevelUpMessage(
	client: Client,
	member: GuildMember,
	ddUser: DDUser,
	previousLevel: number,
) {
	const levelUpChannelId =
		config.channels.levelUp ?? config.channels.botCommands;
	const channel = (await client.channels.fetch(
		levelUpChannelId,
	)) as TextChannel;
	if (!channel) {
		logger.error(
			`Could not find level up channel with id ${config.channels.botCommands}`,
		);
		return;
	}
	await channel.send({
		...renderDiscordMessage(
			<Message isV2>
				<LevelUpCard
					greeting={mentionWithNoPingMessage(member)}
					author={memberAuthor(member)}
					level={ddUser.level}
					previousLevel={previousLevel}
					xp={ddUser.xp}
					tierRole={tierRoleId(ddUser.level)}
				/>
			</Message>,
		),
		// the card mentions them too, which would ping members who opted out
		allowedMentions: { users: userShouldBePinged(member) ? [member.id] : [] },
	});
}

export const tierOf = (level: number) =>
	level <= 0 ? 0 : 1 + Math.floor(level / 10);
