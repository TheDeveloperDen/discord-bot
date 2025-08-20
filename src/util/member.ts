import { Message } from "discord.js";

export async function getMember(message: Message) {
  if (!message.inGuild()) return null;

  if (message.member) {
    return message.member;
  }

  try {
    return await message.guild.members.fetch(message.author.id);
  } catch (error) {
    console.error("Failed to fetch member:", error);
    return null;
  }
}
