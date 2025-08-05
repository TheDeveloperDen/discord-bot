import { GuildMember } from "discord.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { xpForLevel } from "./xpForMessage.util.js";
import { createImage, font, getCanvasContext } from "../../util/imageUtils.js";
import { branding } from "../../util/branding.js";
import { drawText } from "../../util/textRendering.js";

import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord-api-types/v10";
import { formatDayCount, getActualDailyStreak } from "./dailyReward.command.js";
import { wrapInTransaction } from "../../sentry.js";
import { format } from "../core/info.command.js";
import { fakeMention } from "../../util/users.js";
import { Command } from "djs-slash-helper";
import { getResolvedMember } from "../../util/interactions.js";
import { logger } from "../../logging.js";

export const XpCommand: Command<ApplicationCommandType.ChatInput> = {
  name: "xp",
  type: ApplicationCommandType.ChatInput,
  description: "Show a member's XP",
  options: [
    {
      type: ApplicationCommandOptionType.User,
      name: "member",
      description: "The member to show XP for",
      required: false,
    },
  ],

  handle: wrapInTransaction("xp", async (span, interaction) => {
    await interaction.deferReply();

    const targetUser =
      interaction.options.get("member")?.user ?? interaction.user;
    const member =
      getResolvedMember(interaction.options.get("member")?.member) ??
      (await interaction.guild?.members.fetch(targetUser.id));
    if (!member) {
      await interaction.followUp("Member not found");
      return;
    }
    const ddUser = await getOrCreateUserById(BigInt(targetUser.id));
    const xp = ddUser.xp;
    const image = createXpImage(xp, member);
    const embedBuilder = createStandardEmbed(member)
      .setTitle(`Profile of ${fakeMention(targetUser)}`)
      .setFields(
        {
          name: "🔮 Level",
          value: `${ddUser.level}`,
          inline: true,
        },
        {
          name: "📝 Tier",
          value: `${
            ddUser.level === 0 ? 0 : Math.floor(ddUser.level / 10) + 1
          }`,
          inline: true,
        },
        {
          name: "❗ Daily Streak (Current / Highest)",
          value: `${formatDayCount(
            await getActualDailyStreak(ddUser),
          )} / ${formatDayCount(ddUser.highestDailyStreak)}`,
          inline: true,
        },
        {
          name: "📈 XP Difference (Current Level / Next Level)",
          value: `${format(ddUser.xp)}/${format(xpForLevel(ddUser.level + 1))}`,
          inline: true,
        },
        {
          name: "⬆️ XP Needed Until Level Up",
          value: `${format(xpForLevel(ddUser.level + 1) - ddUser.xp)}`,
          inline: true,
        },
        {
          name: "❗Bumps",
          value: format(await ddUser.countBumps()),
          inline: true,
        },
      )
      .setImage("attachment://xp.png");
    logger.debug(
      `Responding with XP embed: ${JSON.stringify(embedBuilder.toJSON())}`,
    );
    await interaction.followUp({
      embeds: [embedBuilder],
      files: [
        {
          attachment: image.createPNGStream(),
          name: "xp.png",
        },
      ],
    });
  }),
};

const xpBackground = createImage(1000, 500, "#171834");

function createXpImage(xp: bigint, user: GuildMember) {
  const [canvas, ctx] = getCanvasContext(1000, 500);
  ctx.drawImage(xpBackground, 0, 0);

  ctx.fillStyle = user.roles?.color?.hexColor ?? branding.color;

  const message = `${xp.toLocaleString()} XP`;
  drawText(
    ctx,
    message,
    font,
    {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    },
    {
      hAlign: "center",
      vAlign: "center",
      maxSize: 450,
      minSize: 1,
      granularity: 3,
    },
  );
  return canvas;
}
