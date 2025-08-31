import {
  ChannelType,
  type Client,
  type EmojiIdentifierResolvable,
  InteractionType,
  type Message,
  type MessageInteraction,
  type PartialTextBasedChannelFields,
} from "discord.js";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { Bump } from "../../store/models/Bump.js";
import {
  clearBumpsCache,
  extractStreaks,
  getAllBumps,
  getBumpStreak,
  getStreaks,
} from "../../store/models/bumps.js";
import { type DDUser, getOrCreateUserById } from "../../store/models/DDUser.js";
import { fakeMention, mentionIfPingable } from "../../util/users.js";
import type { EventListener } from "../module.js";

/**
 * Stores the time of the most recent bump
 *
 * Exported for testing only
 */
export let lastBumpTime = new Date();

/**
 * Stores the time of when the most recent bump notification was sent
 */
let lastBumpNotificationTime = new Date(0);

/**
 * Sets the time of the last bump notification
 *  exported for testing only
 * @param date
 */
export function setLastBumpNotificationTime(date: Date) {
  lastBumpNotificationTime = date;
}

// noinspection JSDeprecatedSymbols
export async function handleBumpStreak(
  bumper: DDUser,
  interactionOld: MessageInteraction,
  message: Message & {
    channel: PartialTextBasedChannelFields;
  },
  client: Client,
) {
  const streak = await getBumpStreak(bumper);
  logger.info(
    `User ${interactionOld.user.id} has a bump streak of ${streak.current} (highest: ${streak.highest})`,
  );
  // cool reactions
  for (let i = 0; i < streak.current; i++) {
    if (i >= streakReacts.length) return;
    await message.react(streakReacts[i]);
  }

  // check if the user dethroned another user

  const allStreaks = getStreaks(extractStreaks(await getAllBumps()));
  if (allStreaks.length > 1) {
    const mostRecent = allStreaks[allStreaks.length - 2];
    logger.debug(`Most recent streak:`, mostRecent);
    logger.debug(
      "Most recent streaks:",
      allStreaks.slice(allStreaks.length - 5),
    );
    if (mostRecent.userId !== bumper.id && mostRecent.current >= 2) {
      const user = await client.users.fetch(mostRecent.userId.toString());
      message.channel.send(
        `${mentionIfPingable(interactionOld.user)} ended ${fakeMention(user)}'s bump streak of ${mostRecent.current}!`,
      );
    }
  }

  // time since last bump
  if (lastBumpNotificationTime.getTime() !== 0) {
    const timeSinceLastBump = Date.now() - lastBumpNotificationTime.getTime();
    if (timeSinceLastBump < 5000) {
      message.channel.send(
        `⚡ ${fakeMention(interactionOld.user)} bumped in just **${timeSinceLastBump / 1000}s**!`,
      );
    } else {
      logger.debug(
        `Time since last bump: ${timeSinceLastBump / 1000}s, not fast enough for a lightning bolt`,
      );
    }
  } else {
    logger.debug("No previous bump notification time");
  }

  if (streak.current < 3) return;

  if (streak.current === streak.highest) {
    // new high score!
    message.channel.send(
      `${mentionIfPingable(interactionOld.user)}, you beat your max bump streak and are now on a streak of ${streak.current}! Keep it up!`,
    );
  }

  const highestStreakEver = allStreaks.sort((a, b) => b.highest - a.highest)[0];
  logger.debug("Highest streak ever: %O", highestStreakEver);
  logger.debug("This streak: %O", streak);
  if (
    highestStreakEver &&
    highestStreakEver.current === streak.current &&
    streak.current === streak.highest && // has to be the current streak
    highestStreakEver.highest === streak.highest && // i think this is maybe error prone tbh
    highestStreakEver.userId === bumper.id
  ) {
    // if they currently have the highest streak
    logger.debug("User has the highest streak");
    message.channel.send(
      `🔥🔥🔥🔥🔥 ${mentionIfPingable(interactionOld.user)}, you have the highest EVER bump streak in the server of ${highestStreakEver.highest}! Keep it up!`,
    );
  }
}

// noinspection JSDeprecatedSymbols
export async function handleBump(
  client: Client,
  bumper: DDUser,
  interactionOld: MessageInteraction,
  message: Message & {
    channel: PartialTextBasedChannelFields;
  },
) {
  lastBumpTime = new Date();

  scheduleBumpReminder(client);

  await handleBumpStreak(bumper, interactionOld, message, client);
}

export const BumpListener: EventListener = {
  ready: async (client) => {
    scheduleBumpReminder(client);
  },
  messageCreate: async (client, message) => {
    const interaction = message.interactionMetadata;

    if (
      !interaction ||
      !(interaction.type === InteractionType.ApplicationCommand)
    )
      return;
    if (message.author.id !== "302050872383242240") return; // /disboard user id
    // noinspection JSDeprecatedSymbols don't think there's another way of doing this
    const interactionOld = message.interaction;
    if (interactionOld?.commandName !== "bump") return;

    // since the bump failed message is ephemeral, we know if we can see the message then the bump succeeded!
    const ddUser = await getOrCreateUserById(BigInt(interactionOld.user.id));

    // Bump
    await Bump.create({
      messageId: BigInt(message.id),
      userId: BigInt(interactionOld.user.id),
      timestamp: new Date(),
    });
    logger.info(
      `User ${interactionOld.user.id} bumped! Total bumps: ${await ddUser.countBumps()}`,
    );
    clearBumpsCache();
    await ddUser.save();
    await handleBump(client, ddUser, interactionOld, message);
  },
};
const streakReacts: EmojiIdentifierResolvable[] = [
  "❤️",
  "🩷",
  "🧡",
  "💛",
  "💚",
  "💙",
  "🩵",
  "💜",
  "🤎",
  "🖤",
  "🔥",
  "‼️",
  "❤️‍🔥",
  "💯",
  "💥",
  "✨",
  "🎉",
  "🎊",
  "👑",
];

function scheduleBumpReminder(client: Client) {
  // schedule a bump reminder for 2 hours from now
  setTimeout(
    async () => await sendBumpNotification(client),
    60 * 60 * 1000 * 2,
  );
  logger.info("Scheduled bump reminder for 2 hours from now");
}

export async function sendBumpNotification(client: Client) {
  // if the last bump was less than 2 hours ago, don't send another notification
  if (Date.now() - lastBumpTime.getTime() < 60 * 60 * 1000 * 2) {
    logger.info(
      `Last bump was less than 2 hours ago (${lastBumpTime.toUTCString()}), not sending bump notification`,
    );
    return;
  }

  const botCommands = await client.channels.fetch(config.channels.botCommands);
  if (!botCommands) {
    logger.error("Bot commands channel not found");
    return;
  }
  if (botCommands.type !== ChannelType.GuildText) {
    logger.error("Bot commands channel is not a text channel");
    return;
  }

  const bumpNotificationsRoleId = config.roles.bumpNotifications;
  if (!bumpNotificationsRoleId) {
    logger.error("Bump notifications role not found");
    return;
  }
  const bumpNotificationsRole = await (
    await client.guilds.fetch(config.guildId)
  ).roles.fetch(bumpNotificationsRoleId);

  if (!bumpNotificationsRole) {
    logger.error("Bump notifications role not found");
    return;
  }
  logger.info("Sending bump notification!");

  await botCommands.send({
    content: `${bumpNotificationsRole}, The server is ready to be bumped! </bump:947088344167366698>`,
  });
  lastBumpNotificationTime = new Date();
}
