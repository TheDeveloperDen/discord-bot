import {SlashCommandBuilder} from '@discordjs/builders'
import {CommandInteraction, GuildMember, MessageEmbedOptions, User} from 'discord.js'
import {getUserById} from '../store/models/DDUser.js'
import {createImage, getCanvasContext, hortaFont} from '../util/imageUtils.js'
import {createStandardEmbed} from '../util/embeds.js'
import {xpForLevel} from '../xp/experienceCalculations.js'
import {Command} from './Commands.js'
import {config} from '../Config.js'
import {drawText} from '../util/textRendering.js'


export class XPCommand implements Command {
	info = new SlashCommandBuilder()
		.setName('xp')
		.setDescription('Show a member\'s XP')
		.addUserOption(option => option
			.setName('member')
			.setDescription('The member to show XP for')
			.setRequired(false))


	async execute(interaction: CommandInteraction) {
		const user = interaction.options.getUser('member') || interaction.user as User
		const member = interaction.options.getMember('member') as GuildMember ?? interaction.member as GuildMember
		const ddUser = await getUserById(BigInt(user.id))
		const xp = ddUser.xp

		await interaction.deferReply()
		const image = await createXPImage(xp, member)
		await interaction.followUp({
			embeds: [{
				...createStandardEmbed(member),
				title: `Profile of ${user.username}#${user.discriminator}`,
				fields: [
					{
						name: '🔮 Level',
						value: `${ddUser.level}`
					},
					{
						name: '📝 Tier',
						value: `${ddUser.level == 0 ? 0 : Math.floor(ddUser.level / 10) + 1}`
					},
					{
						name: '❗ Disboard Bumps',
						value: `${ddUser.bumps}`
					},
					{
						name: '📈 XP Until Level Up',
						value: `${ddUser.xp}/${xpForLevel(ddUser.level + 1)}`
					}
				],
				image: {url: 'attachment://xp.png'}
			} as MessageEmbedOptions],
			files: [{attachment: image.toBuffer(), name: 'xp.png'}]
		})
	}

}

const xpBackground = createImage(1000, 500, '#2b2d2f')
const createXPImage = async (xp: number, user: GuildMember) => {
	const [canvas, ctx] = getCanvasContext(1000, 500)
	ctx.drawImage(xpBackground, 0, 0)

	ctx.fillStyle = user.roles?.color?.hexColor ?? config.color

	const message = `${xp.toLocaleString()} XP`
	drawText(ctx, message, hortaFont, {
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
