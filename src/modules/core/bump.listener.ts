import { EventListener } from "../module.js";
import { ChannelType, InteractionType } from "discord.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { logger } from "../../logging.js";
import { config } from "../../Config.js";
import { Client, EmojiIdentifierResolvable } from "discord.js";
import {
  Bump,
  extractStreaks,
  getAllBumps,
  getBumpStreak,
  getStreaks,
} from "../../store/models/Bump.js";
import { fakeMention, mentionIfPingable } from "../../util/users.js";

export const BumpListener: EventListener = {
  ready: async (client) => {
    scheduleBumpReminder(client);
  },
  messageCreate: async (client, message) => {
    const interaction = message.interactionMetadata;

    if (
      !interaction ||
      !(interaction.type == InteractionType.ApplicationCommand)
    )
      return;
    if (message.author.id != "302050872383242240") return; // /disboard user id
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
    await ddUser.save();

    lastBumpTime = new Date();
    scheduleBumpReminder(client);

    const streak = await getBumpStreak(ddUser);
    logger.info(
      `User ${interactionOld.user.id} has a bump streak of ${streak.current} (highest: ${streak.highest})`,
    );
    // cool reactions
    for (let i = 0; i < streak.current; i++) {
      if (i >= streakReacts.length) return;
      message.react(streakReacts[i]!);
    }

    if (streak.current < 3) return;

    if (streak.current == streak.highest) {
      // new high score!
      message.channel.send(
        `${mentionIfPingable(interactionOld.user)}, you beat your max bump streak and are now on a streak of ${streak.current}! Keep it up!`,
      );
    }

    const allStreaks = getStreaks(extractStreaks(await getAllBumps()));

    const highestStreakEver = allStreaks.sort(
      (a, b) => b.highest - a.highest,
    )[0];
    if (highestStreakEver) {
      message.channel.send(
        `🔥🔥🔥🔥🔥 ${mentionIfPingable(interactionOld.user)}, you have the highest EVER bump streak in the server of ${highestStreakEver.highest}! Keep it up!`,
      );
    }

    // check if the user dethroned another user

    const mostRecent = allStreaks[allStreaks.length - 1]!;
    if (mostRecent.userId != ddUser.id && mostRecent.current >= 2) {
      const user = await client.users.fetch(mostRecent.userId.toString());
      message.channel.send(
        `${mentionIfPingable(interactionOld.user)} ended ${fakeMention(user)}'s bump streak of ${mostRecent.current}!`,
      );
    }
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

let lastBumpTime = new Date();

function scheduleBumpReminder(client: Client) {
  // schedule a bump reminder for 2 hours from now
  setTimeout(
    async () => await sendBumpNotification(client),
    60 * 60 * 1000 * 2,
  );
  logger.info("Scheduled bump reminder for 2 hours from now");
}

async function sendBumpNotification(client: Client) {
  // if the last bump was less than 2 hours ago, don't send another notification
  if (new Date().getTime() - lastBumpTime.getTime() < 60 * 60 * 1000 * 2) {
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
  if (botCommands.type != ChannelType.GuildText) {
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
}
