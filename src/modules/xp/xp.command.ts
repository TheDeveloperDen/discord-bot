import type { GuildMember } from "discord.js";
import { defineCommand, option } from "../../commands/index.js";
import { logger } from "../../logging.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";
import { branding } from "../../util/branding.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { createImage, getCanvasContext } from "../../util/imageUtils.js";
import { drawText } from "../../util/textRendering.js";
import { fakeMention } from "../../util/users.js";
import { format } from "../core/info.command.js";
import { profileFont } from "../user/user.js";
import { formatDayCount, getActualDailyStreak } from "./dailyReward.command.js";
import { getTierByLevel, xpForLevel } from "./xpForMessage.util.js";

export const XpCommand = defineCommand({
	name: "xp",
	description: "Show a member's XP",
	options: {
		member: option.member({
			description: "The member to show XP for",
		}),
	},

	async handle(interaction, { member = interaction.member }) {
		const targetUser = member.user;

		await interaction.deferReply();
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
					value: `${getTierByLevel(ddUser.level)}`,
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
					attachment: image.toBuffer("image/png"),
					name: "xp.png",
				},
			],
		});
	},
});

const xpBackground = createImage(1000, 500, "#171834");

function createXpImage(xp: bigint, user: GuildMember) {
	const [canvas, ctx] = getCanvasContext(1000, 500);
	ctx.drawImage(xpBackground, 0, 0);

	ctx.fillStyle = user.roles?.color?.hexColor ?? branding.color;

	const message = `${xp.toLocaleString()} XP`;
	drawText(
		ctx,
		message,
		{
			x: 0,
			y: 0,
			width: canvas.width,
			height: canvas.height,
		},
		{
			fontFamily: profileFont,
			hAlign: "center",
			vAlign: "center",
			maxSize: 450,
			minSize: 1,
			granularity: 3,
		},
	);
	return canvas;
}
