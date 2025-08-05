import { APIApplicationCommandOptionChoice, GuildMember } from "discord.js";

import { DDUser } from "../../store/models/DDUser.js";
import { Command } from "djs-slash-helper";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord-api-types/v10";
import { createStandardEmbed } from "../../util/embeds.js";
import { branding } from "../../util/branding.js";
import { actualMention } from "../../util/users.js";
import { getActualDailyStreak } from "./dailyReward.command.js";
import { wrapInTransaction } from "../../sentry.js";

type KeysMatching<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

type LeaderboardSelection =
  | ((user: DDUser) => Promise<number>)
  | KeysMatching<DDUser, number | bigint>;

interface LeaderboardType extends APIApplicationCommandOptionChoice<string> {
  select: LeaderboardSelection;
  value: string;
  format: (value: number | bigint) => string;
}

const info: LeaderboardType[] = [
  {
    select: "xp",
    value: "xp",
    name: "XP",
    format: (value) => `${value.toLocaleString()} XP`,
  },
  {
    select: "level",
    value: "level",
    name: "Level",
    format: (value) => `Level ${value}`,
  },
  {
    name: "Current Daily Streak",
    value: "currentDailyStreak",
    select: async (user) => await getActualDailyStreak(user),
    format: (s) => `${formatDays(s)}`,
  },
  {
    name: "Highest Daily Streak",
    value: "highestDailyStreak",
    select: "highestDailyStreak",
    format: (s) => `${formatDays(s)}`,
  },
  {
    name: "Disboard Bumps",
    value: "bumps",
    select: async (user) => user.countBumps(),
    format: (value) =>
      value == 1 ? "1 Bump" : `${value.toLocaleString()} Bumps`,
  },
];

export const LeaderboardCommand: Command<ApplicationCommandType.ChatInput> = {
  type: ApplicationCommandType.ChatInput,
  name: "leaderboard",
  description: "Show the top 10 users based on XP, Level, or Daily Streak",
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "type",
      description: "The type of leaderboard to show",
      required: true,
      choices: info,
    },
  ],

  handle: wrapInTransaction("leaderboard", async (span, interaction) => {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (guild == null) {
      await interaction.followUp("This command can only be used in a server");
      return;
    }
    const option = interaction.options.get("type", true).value as string;
    const traitInfo = info.find((it) => it.value === option);
    if (traitInfo == null) {
      await interaction.followUp("Invalid leaderboard type");
      return;
    }
    if (traitInfo.value === "currentDailyStreak") {
      // manually refresh all the dailies. this is not very efficient
      const all = await DDUser.findAll();
      await Promise.all(all.map(getActualDailyStreak));
    }
    const { format, value, name } = traitInfo;

    const select = traitInfo.select;
    const calculate: (user: DDUser) => Promise<number | bigint> =
      select instanceof Function
        ? select
        : async (user: DDUser) => user[select];

    const users = await DDUser.findAll({
      order: [[value, "DESC"]],
      limit: 10,
    }).then((users) => users.filter(async (it) => (await calculate(it)) > 0));

    if (users.length === 0) {
      await interaction.followUp("No applicable users");
      return;
    }
    const embed = {
      ...createStandardEmbed(interaction.member as GuildMember),
      title: `${branding.name} Leaderboard`,
      description: `The top ${users.length} users based on ${name}`,
      fields: await Promise.all(
        users.map(async (user, index) => {
          const discordUser = await guild.client.users
            .fetch(user.id.toString())
            .catch(() => null);

          return {
            name: `${medal(index)} #${index + 1} - ${format(await calculate(user))}`.trimStart(),
            value:
              discordUser == null ? "Unknown User" : actualMention(discordUser),
          };
        }),
      ),
    };
    await interaction.followUp({ embeds: [embed] });
  }),
};

function medal(index: number): string {
  switch (index) {
    case 0:
      return "🥇";
    case 1:
      return "🥈";
    case 2:
      return "🥉";
    default:
      return "";
  }
}

function formatDays(days: number | bigint) {
  if (days === 1) {
    return "1 day";
  }
  return `${days} days`;
}
