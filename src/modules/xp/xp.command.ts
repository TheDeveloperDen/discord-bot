import {GuildMember, User} from 'discord.js'
import {getUserById} from '../../store/models/DDUser.js'
import {createStandardEmbed} from '../../util/embeds.js'
import {xpForLevel} from './xpForMessage.util.js'
import {createImage, font, getCanvasContext} from '../../util/imageUtils.js'
import {branding} from '../../util/branding.js'
import {drawText} from '../../util/textRendering.js'
import {Command} from 'djs-slash-helper'
import {ApplicationCommandOptionType, ApplicationCommandType} from 'discord-api-types/v10'
import {formatDayCount, getActualDailyStreak} from './dailyReward.command.js'
import {inTransaction} from '../../sentry.js'


export const XpCommand: Command<ApplicationCommandType.ChatInput> = {
	name: 'xp',
	type: ApplicationCommandType.ChatInput,
	description: 'Show a member\'s XP',
	options: [{
		type: ApplicationCommandOptionType.User,
		name: 'member',
		description: 'The member to show XP for',
		required: false
	}],


	handle: inTransaction('xp', async (interaction) => {
		await interaction.deferReply()
		const user = interaction.options.getUser('member') ?? interaction.user as User
		const member = (interaction.options.getMember('member') ?? interaction.member) as GuildMember
		const ddUser = await getUserById(BigInt(user.id))
		const xp = ddUser.xp
		const image = createXpImage(xp, member)
		await interaction.followUp({
			embeds: [
				createStandardEmbed(member)
					.setTitle(`Profile of ${user.username}#${user.discriminator}`)
					.setFields({
							name: '🔮 Level',
							value: `${ddUser.level}`
						},
						{
							name: '📝 Tier',
							value: `${ddUser.level == 0 ? 0 : Math.floor(ddUser.level / 10) + 1}`
						},
						{
							name: '❗ Daily Streak (Current / Highest)',
							value: `${formatDayCount(await getActualDailyStreak(ddUser))} / ${formatDayCount(ddUser.highestDailyStreak)}`
						},
						{
							name: '📈 XP Difference (Current Level / Next Level)',
							value: `${ddUser.xp}/${xpForLevel(ddUser.level + 1)}`
						},
						{
							name: '⬆️ XP Needed Until Level Up',
							value: `${xpForLevel(ddUser.level + 1) - ddUser.xp}`
						},
					)
					.setImage('attachment://xp.png')
			],
			files: [{ attachment: image.toBuffer(), name: 'xp.png' }]
		})
	})

}

const xpBackground = createImage(1000, 500, '#171834')

function createXpImage(xp: number, user: GuildMember) {
	const [canvas, ctx] = getCanvasContext(1000, 500)
	ctx.drawImage(xpBackground, 0, 0)

	ctx.fillStyle = user.roles?.color?.hexColor ?? branding.color

	const message = `${xp.toLocaleString()} XP`
	drawText(ctx, message, font, {
		x: 0,
		y: 0,
		width: canvas.width,
		height: canvas.height,
	}, {
		hAlign: 'center',
		vAlign: 'center',
		maxSize: 450,
		minSize: 1,
		granularity: 3
	})
	return canvas
}
