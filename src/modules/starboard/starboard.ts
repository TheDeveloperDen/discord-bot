import { EmbedBuilder, GuildMember, Message, Snowflake } from "discord.js";
import { StarboardMessage } from "../../store/models/StarboardMessage.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { config } from "../../Config.js";

export const createStarboardMessage: (
  originalMessageId: Snowflake,
  starboardMessageId: Snowflake,
) => Promise<StarboardMessage> = async (
  originalMessageId,
  starboardMessageId,
) => {
  return await StarboardMessage.create({
    originalMessageId: BigInt(originalMessageId),
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

export const createStarboardEmbedFromMessage: (
  message: Message,
  member: GuildMember,
  stars: number,
) => EmbedBuilder = (message, member, stars) => {
  return createStandardEmbed(member)
    .setColor("Yellow")
    .setAuthor({
      name: member.displayName,
      iconURL: member.user.displayAvatarURL(),
      url: `https://discord.com/users/${member.id}`,
    })
    .setURL(message.url)
    .addFields([
      {
        name: "Source:",
        value: `[Jump](${message.url})`,
        inline: true,
      },
      {
        name: `${config.starboard.emojiId}`,
        value: `${stars}`,
        inline: true,
      },
    ])
    .setDescription(message.content);
};
