import { Client, GuildMember, TextChannel } from "discord.js";
import { DDUser } from "../../store/models/DDUser.js";
import { modifyRoles } from "../../util/roles.js";
import { config } from "../../Config.js";
import { createStandardEmbed } from "../../util/embeds.js";
import {
  actualMention,
  mentionWithNoPingMessage,
  fakeMention,
} from "../../util/users.js";
import { tierRoleId, xpForLevel } from "./xpForMessage.util.js";
import { logger } from "../../logging.js";

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
  ddUser.level = newLevel;
  logger.info(`${ddUser.id} leveling up to ${newLevel}`);
  await applyTierRoles(client, user, ddUser);
  await sendLevelUpMessage(client, user, ddUser);
}

export function levelForXp(xp: bigint) {
  let level = 0;
  while (xp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}

async function applyTierRoles(
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
) {
  const user = member.user;
  const channel = (await client.channels.fetch(
    config.channels.botCommands,
  )) as TextChannel;
  if (!channel) {
    console.error(
      `Could not find level up channel with id ${config.channels.botCommands}`,
    );
    return;
  }
  const embed = createStandardEmbed(member)
    .setTitle("⚡ Level Up!")
    .setAuthor({
      name: fakeMention(user),
      iconURL: user.avatarURL() ?? undefined,
    })
    .setFields({
      name: "📈 XP",
      value: `${ddUser.xp}/${xpForLevel(ddUser.level + 1)}`,
    })
    .setDescription(
      `${actualMention(member)}, you leveled up to level **${ddUser.level}**!`,
    );

  const message = mentionWithNoPingMessage(member);
  await channel.send({
    content: message,
    embeds: [embed],
  });
}

export const tierOf = (level: number) =>
  level <= 0 ? 0 : 1 + Math.floor(level / 10);
