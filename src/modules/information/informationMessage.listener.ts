import {EventListener} from '../module.js'
import {FAQ} from '../../store/models/FAQ.js'
import {createFaqEmbed} from '../faq/faq.util.js'
import {ActionRowBuilder, ButtonInteraction, GuildMember, SelectMenuBuilder, SelectMenuOptionBuilder} from 'discord.js'
import {getAllCachedResources, getResource} from '../learning/resourcesCache.util.js'
import {truncateTo} from '../../util/strings.js'
import {getEmoji, toComponentEmojiResolvable} from '../../util/emojis.js'
import {getResourceEmbed} from '../learning/learning.command.js'

export const InformationButtonListener: EventListener = {
	async interactionCreate(_, interaction) {

		if (interaction.isStringSelectMenu() && interaction.customId == 'learningResourcePicker') {
			const resourceName = interaction.values[0]
			const resource = await getResource(resourceName)
			const embed = getResourceEmbed(interaction.client, resource, interaction.user, interaction.member as GuildMember ?? undefined,)

			await interaction.reply({
				embeds: [embed],
				ephemeral: true
			})
			return
		}

		if (!interaction.isButton()) {
			return
		}
		const id = interaction.customId
		if (id === 'learning-resources') {
			await sendLearningResourcesPicker(interaction)
			return
		}
		if (!id.startsWith('faq-')) {
			return
		}
		const faqId = id.substring(4)

		const faq = await FAQ.findOne({
			where: {
				name: faqId
			}
		})

		if (!faq) {
			return
		}
		const embed = createFaqEmbed(faq, interaction.user, interaction.member as GuildMember ?? undefined)
		await interaction.reply({
			ephemeral: true,
			embeds: [embed]
		})
	}
}

async function sendLearningResourcesPicker(interaction: ButtonInteraction) {
	const selectMenu = new SelectMenuBuilder()
		.setCustomId('learningResourcePicker')
		.setPlaceholder('Select a resource')
		.setOptions(
			getAllCachedResources()
				.map(res => {
					const builder = new SelectMenuOptionBuilder()
						.setLabel(res.name)
						.setValue(res.name)
						.setDescription(truncateTo(res.description, 100))
					if (res.emoji) {
						const parse = getEmoji(interaction.client, res.emoji)
						if (parse) {
							builder.setEmoji(toComponentEmojiResolvable(parse))
						}
					}
					return builder
				})
		)

	await interaction.reply({
		components: [new ActionRowBuilder<SelectMenuBuilder>().addComponents(selectMenu)],
		ephemeral: true,
		fetchReply: true
	})

}