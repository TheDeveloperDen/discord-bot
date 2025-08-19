import { EventListener } from "../module.js";
import { config } from "../../Config.js";
import {
  createStarboardEmbedFromMessage,
  createStarboardMessage,
  getStarboardMessageForOriginalMessageId,
} from "./starboard.js";

export const StarboardListener: EventListener = {
  async messageReactionAdd(_, reaction) {
    if (
      !reaction.message.inGuild() ||
      reaction.message.channel.id === config.starboard.channel
    )
      return;
    if (reaction.emoji.name === config.starboard.emojiId) {
      await reaction.fetch();
      const count = reaction.count || 1;
      console.log(count);
      if (count >= config.starboard.threshold) {
        const starboardChannel = await reaction.message.guild.channels.fetch(
          config.starboard.channel,
        );

        if (
          starboardChannel == null ||
          !starboardChannel.isTextBased() ||
          !starboardChannel.isSendable()
        ) {
          console.error(
            "Starboard channel not found, not a text channel or not sendable",
          );
          return;
        }
        const existingStarboardMessage =
          await getStarboardMessageForOriginalMessageId(reaction.message.id);
        try {
          const member = await reaction.message.guild.members.fetch(
            reaction.message.author.id,
          );
          if (existingStarboardMessage) {
            // Already on the starboard so update it
            try {
              let starboardMessage;
              try {
                starboardMessage = await starboardChannel.messages.fetch(
                  existingStarboardMessage.starboardMessageId.toString(),
                );
              } catch (error) {
                // If the message is not found, it means it was deleted, so we delete the entry from the database
                await existingStarboardMessage.destroy();
                console.error("Error fetching the starboard message:", error);
              }
              // If there is no starboardMessageFound then we create on again.
              if (starboardMessage) {
                const starboardEmbed = createStarboardEmbedFromMessage(
                  reaction.message,
                  member,
                  count,
                );
                await starboardMessage.edit({
                  embeds: [starboardEmbed],
                });
                return;
              }
            } catch (error) {
              console.error("Error updating the starboard message:", error);
              return;
            }
          }

          const embed = createStarboardEmbedFromMessage(
            reaction.message,
            member,
            count,
          );

          const message = await starboardChannel.send({
            embeds: [embed],
            allowedMentions: {
              parse: [],
            },
          });

          await createStarboardMessage(reaction.message.id, message.id);
        } catch (error) {
          console.error("Error sending starboard message:", error);
        }
      }
    }
  },
};
