import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  GuildMember,
} from "discord.js";
import { Command } from "djs-slash-helper";

import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord-api-types/v10";
import { DDUser, getOrCreateUserById } from "../../store/models/DDUser.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { mentionIfPingable } from "../../util/users.js";
import { levelForXp } from "../xp/xpRoles.util.js";

export const SetCommand: Command<ApplicationCommandType.ChatInput> = {
  type: ApplicationCommandType.ChatInput,
  name: "set",
  default_permission: false,
  description: "Set data for a user",
  options: [
    {
      type: ApplicationCommandOptionType.User,
      name: "target",
      description: "The user to edit",
      required: true,
    },
    {
      type: ApplicationCommandOptionType.String,
      name: "field",
      description: "The field to edit",
      required: true,
      choices: ["xp", "bumps"].map((it) => ({
        name: it,
        value: it,
      })),
    },
    {
      type: ApplicationCommandOptionType.Integer,
      name: "value",
      description: "The value to set",
      required: true,
    },
  ],

  async handle(interaction) {
    const target = interaction.options.get("target")?.member;
    if (!(target instanceof GuildMember)) {
      await interaction.reply("Could not find user");
      return;
    }
    const user = await getOrCreateUserById(BigInt(target.id));

    const option = interaction.options.get("field", true).value as string;
    const getter = getters.get(option);
    const setter = setters.get(option);
    if (getter == null || setter == null) return;
    const value = interaction.options.get("value", true).value as number;

    const embed = createStandardEmbed(target)
      .setTitle("Confirm")
      .setDescription(
        `Are you sure you want to set ${mentionIfPingable(
          target
        )}'s ${option} to ${value}?`
      )
      .setFields([
        {
          name: "Current Value",
          value: getter(user).toString(),
          inline: true,
        },
        {
          name: "New Value",
          value: value.toString(),
          inline: true,
        },
      ]);
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm")
        .setStyle(ButtonStyle.Success)
        .setLabel("Confirm"),
      new ButtonBuilder()
        .setCustomId("cancel")
        .setStyle(ButtonStyle.Danger)
        .setLabel("Cancel")
    );
    const reply = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      fetchReply: true,
    });

    const channel = interaction.channel;
    if (channel == null) {
      await interaction.reply("You can't do this in DMs");
      return;
    }
    if (!channel.isSendable()) {
      await interaction.reply("Channel is not sendable");
      return;
    }
    const collector =
      channel.createMessageComponentCollector<ComponentType.Button>({
        filter: (i) =>
          i.isButton() &&
          i.message?.interactionMetadata?.id === interaction.id &&
          i.user.id === interaction.user.id,
        time: 15000,
        maxComponents: 1,
      });

    const event = await collector.next;
    if (event.customId === "cancel") {
      await event.reply({
        ephemeral: true,
        content: "**Cancelled**",
      });
    } else if (event.customId === "confirm") {
      await event.deferReply();
      setter(user, value);
      await user.save();
      await event.followUp({
        ephemeral: true,
        embeds: [
          createStandardEmbed(target)
            .setTitle("Success")
            .setColor(Colors.Green)
            .setDescription(
              `Set ${mentionIfPingable(target)}'s ${option} to ${value}`
            ),
        ],
      });
    }
    await reply.delete();
  },
};

const getters = new Map([
  ["xp", (user: DDUser) => user.xp],
  ["bumps", (user: DDUser) => BigInt(user.bumps)],
]);

const setters = new Map([
  [
    "xp",
    (user: DDUser, value: number) => {
      user.xp = BigInt(value);
      user.level = levelForXp(user.xp);
    },
  ],
  [
    "bumps",
    (user: DDUser, value: number) => {
      user.bumps = value;
    },
  ],
]);

export default SetCommand;
