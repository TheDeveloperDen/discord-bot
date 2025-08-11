import { CommandInteraction, GuildMember } from "discord.js";
import { Command } from "djs-slash-helper";
import { ApplicationCommandType } from "discord.js";
import { DDUser } from "../../store/models/DDUser.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { branding } from "../../util/branding.js";
import { logger } from "../../logging.js";

export const InfoCommand: Command<ApplicationCommandType.ChatInput> = {
  type: ApplicationCommandType.ChatInput,
  name: "info",
  description: "Show information about the bot and server",
  options: [],

  async handle(interaction: CommandInteraction) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (guild == null) {
      await interaction.reply("This command can only be used in a server");
      return;
    }
    const totalXP = (await DDUser.sum("xp")) ?? 0;
    const memberCount = guild.memberCount;
    const membersStored = await DDUser.count();
    const dateCreated = `
            <t:${(guild.createdAt.getTime() / 1000) | 0}>`;
    const levelUps = (await DDUser.sum("level")) ?? 0;
    logger.debug(`totalXP: ${totalXP} (${typeof totalXP})`);
    await interaction.followUp({
      embeds: [
        createStandardEmbed(interaction.member as GuildMember)
          .setTitle(branding.name)
          .setDescription(
            "This is the bot for the Developer Den server. It's written in **TypeScript** using the **Discord.js** library. " +
              "The source can be found [here](https://github.com/TheDeveloperDen/DevDenBot)",
          )
          .setFields([
            {
              name: "Version",
              value: format(
                process.env.npm_package_version ??
                  process.env.VERSION ??
                  "Unknown",
              ),
              inline: true,
            },
            {
              name: "Bot Uptime",
              value: `<t:${
                Math.round(Date.now() / 1000) - Math.floor(process.uptime())
              }:R>`,
              inline: true,
            },
            {
              name: "Total XP",
              value: format(totalXP),
              inline: true,
            },
            {
              name: "Member Count",
              value: format(memberCount),
              inline: true,
            },
            {
              name: "Members Stored",
              value: format(membersStored),
              inline: true,
            },
            {
              name: "Level Ups",
              value: format(levelUps),
              inline: true,
            },
            {
              name: "Date Created",
              value: dateCreated,
              inline: true,
            },
          ]),
      ],
    });
  },
};

export const format = (val: string | bigint | number) => {
  if (typeof val === "string") {
    return `\`${val}\``;
  } else {
    const format = Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
      style: "decimal",
    });
    return `\`${format.format(val)}\``;
  }
};

export default InfoCommand;
