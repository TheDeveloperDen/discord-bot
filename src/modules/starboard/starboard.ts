import {
  ColorResolvable,
  EmbedBuilder,
  GuildMember,
  Message,
  Snowflake,
} from "discord.js";
import { StarboardMessage } from "../../store/models/StarboardMessage.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { config } from "../../Config.js";

export const createStarboardMessage: (
  originalMessageId: Snowflake,
  originalMessageChannelId: Snowflake,
  starboardMessageId: Snowflake,
) => Promise<StarboardMessage> = async (
  originalMessageId,
  originalMessageChannelId,
  starboardMessageId,
) => {
  return await StarboardMessage.create({
    originalMessageId: BigInt(originalMessageId),
    originalMessageChannelId: BigInt(originalMessageChannelId),
    starboardMessageId: BigInt(starboardMessageId),
  });
};

export const getStarboardMessageForOriginalMessageId: (
  originalMessageId: Snowflake,
) => Promise<StarboardMessage | null> = async (originalMessageId) => {
  return await StarboardMessage.findOne({
    where: {
      originalMessageId: BigInt(originalMessageId),
    },
  });
};

const getColorForStars: (stars: number) => ColorResolvable = (
  stars: number,
) => {
  const overthreshold = stars - config.starboard.threshold;
  switch (overthreshold) {
    case 2:
      return "Red";
    case 4:
      return "Orange";
    case 6:
      return "Gold";

    default:
      return "Blue";
  }
};

export const createStarboardEmbedFromMessage: (
  message: Message,
  member: GuildMember,
  stars: number,
) => EmbedBuilder = (message, member, stars) => {
  return createStandardEmbed(member)
    .setColor(getColorForStars(stars))
    .setAuthor({
      name: member.displayName,
      iconURL: member.user.displayAvatarURL(),
      url: `https://discord.com/users/${member.id}`,
    })
    .setURL(message.url)
    .addFields([
      {
        name: "Details:",
        value: `${config.starboard.emojiId}: ${stars} | [Source](${message.url})`,
      },
    ])
    .setDescription(message.content);
};
