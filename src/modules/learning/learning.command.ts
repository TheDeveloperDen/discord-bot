import { Command, ExecutableSubcommand } from "djs-slash-helper";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  PermissionFlagsBits,
} from "discord.js";
import {
  getAllCachedResources,
  getResource,
  updateAllResources,
} from "./resourcesCache.util.js";
import { Client, GuildMember, User } from "discord.js";
import { createStandardEmbed, standardFooter } from "../../util/embeds.js";
import { fakeMention } from "../../util/users.js";
import { moduleManager } from "../../index.js";
import { getEmoji, stringifyEmoji } from "../../util/emojis.js";
import { logger } from "../../logging.js";
import { LearningResource } from "./learningResource.model.js";

const resources: Array<{ name: string; value: string }> = [];

export async function updateResourcesForCommands() {
  logger.debug("Updating resource for commands");
  await updateAllResources();
  const result = getAllCachedResources().map(([fileName, res]) => ({
    name: res.name,
    value: fileName,
  }));
  resources.length = 0;
  resources.push(...result);
  logger.debug(`resources = ${JSON.stringify(resources)}`);
}

const extraFooter =
  "\n\n[**Contribute to our resource collection!**](https://github.com/TheDeveloperDen/LearningResources)";

function createBulletList(title: string, entries: string[]) {
  if (entries.length === 0) return "";
  return `**${title}**\n${entries.map((i) => "• " + i).join("\n")}`;
}

export function getResourceEmbed(
  client: Client,
  resourceSet: LearningResource,
  user?: User,
  member?: GuildMember,
) {
  logger.debug(`Rendering ${JSON.stringify(resourceSet)} as an embed...`);
  const embed = createStandardEmbed(member)
    .setTitle(resourceSet.name)
    .setDescription(
      `**${resourceSet.description}**\n\n` +
        resourceSet.resources
          .map((res) => {
            const pros = createBulletList("Pros", res.pros);
            const cons = createBulletList("Cons", res.cons);
            const description = res.description ? `${res.description}\n` : "";
            const linkedName = `[${res.name}](${res.url})`;
            const price = res.price ? `${res.price}` : "Free!";
            return `${linkedName} - ${price}${description}\n${pros}\n${cons}`.trim();
          })
          .join("\n\n") +
        extraFooter,
    );

  if (!user || !member) {
    const requester = user ?? member?.user;
    if (!requester) {
      logger.error(
        "Could not get requester for resource embed. this should never happen.",
      );
      throw new Error();
    }
    embed.setFooter({
      ...standardFooter(),
      text: `Requested by ${fakeMention(requester)} | Learning Resources`,
    });
  }

  if (resourceSet.emoji) {
    const emoji = getEmoji(client, resourceSet.emoji);

    if (!emoji) {
      logger.warn(
        `Could not find emoji ${resourceSet.emoji} for resource ${resourceSet.name}`,
      );
    } else {
      embed.setTitle(`${stringifyEmoji(emoji)} ${resourceSet.name}`);
    }
  }
  return embed;
}

const LearningGetSubcommand: ExecutableSubcommand = {
  type: ApplicationCommandOptionType.Subcommand,
  name: "get",
  description: "Get a learning resource",
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "resource",
      description: "The resource to lookup",
      choices: resources,
      required: true,
    },
  ],
  async handle(interaction) {
    const name = interaction.options.get("resource")?.value as string | null;
    if (!name) return;
    const resource = await getResource(name);
    if (resource == null) {
      return await interaction.reply(`Could not find resource ${name}`);
    }

    const embed = getResourceEmbed(
      interaction.client,
      resource,
      interaction.user,
      (interaction.member as GuildMember) ?? undefined,
    );
    await interaction.reply({ embeds: [embed] });
  },
};

const LearningUpdateSubcommand: ExecutableSubcommand = {
  type: ApplicationCommandOptionType.Subcommand,
  name: "update",
  description: "Update the learning resources cache",
  async handle(interaction) {
    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return await interaction.reply({
        flags: ["Ephemeral"],
        content: "No permission",
      });
    }

    await interaction.deferReply({ ephemeral: true });
    await updateResourcesForCommands();
    await moduleManager.refreshCommands();
    await interaction.followUp("Updated learning resources cache");
  },
};

const LearningListSubcommand: ExecutableSubcommand = {
  type: ApplicationCommandOptionType.Subcommand,
  name: "list",
  description: "List all learning resources",
  options: [],

  async handle(interaction) {
    const resources = getAllCachedResources()
      .map(([, res]) => res.name)
      .join(", ");
    const embed = createStandardEmbed(
      (interaction.member as GuildMember) ?? undefined,
    )
      .setTitle("Resource List")
      .setDescription(resources + extraFooter)
      .setFooter({
        ...standardFooter(),
        text: `Requested by ${fakeMention(
          interaction.user,
        )} | Learning Resources`,
      });

    await interaction.reply({
      flags: ["Ephemeral"],
      embeds: [embed],
    });
  },
};

export const LearningCommand: Command<ApplicationCommandType.ChatInput> = {
  type: ApplicationCommandType.ChatInput,
  name: "learning",
  description: "Manage learning resources",
  options: [
    LearningListSubcommand,
    LearningGetSubcommand,
    LearningUpdateSubcommand,
  ],
  handle() {},
};
