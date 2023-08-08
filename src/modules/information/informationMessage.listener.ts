import { EventListener } from '../module.js'
import { FAQ } from '../../store/models/FAQ.js'
import { createFaqEmbed } from '../faq/faq.util.js'
import {
  ActionRowBuilder,
  ButtonInteraction,
  GuildMember,
  Interaction,
  SelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js'
import { getAllCachedResources, getResource } from '../learning/resourcesCache.util.js'
import { truncateTo } from '../../util/strings.js'
import { getEmoji, toAPIMessageComponentEmoji } from '../../util/emojis.js'
import { getResourceEmbed } from '../learning/learning.command.js'

export const InformationButtonListener: EventListener = {
  async interactionCreate (client, interaction: Interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'learningResourcePicker') {
      const resourceName = interaction.values[0]
      await interaction.deferReply({ ephemeral: true })
      const resource = await getResource(resourceName)
      if (resource == null) {
        return // shouldn't ever happen
      }
      const embed = getResourceEmbed(
        interaction.client,
        resource,
        interaction.user,
        interaction.member as GuildMember ?? undefined
      )

      await interaction.followUp({
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
    await interaction.deferReply({ ephemeral: true })
    const faq = await FAQ.findOne({
      where: {
        name: faqId
      }
    })

    if (faq == null) {
      return
    }
    const embed = createFaqEmbed(
      faq,
      interaction.user,
      interaction.member as GuildMember ?? undefined
    )
    await interaction.followUp({
      ephemeral: true,
      embeds: [embed]
    })
  }
}

async function sendLearningResourcesPicker (interaction: ButtonInteraction) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('learningResourcePicker')
    .setPlaceholder('Select a resource')
    .setOptions(
      getAllCachedResources()
        .map(([file, res]) => {
          const builder = new StringSelectMenuOptionBuilder()
            .setLabel(res.name)
            .setValue(file)
            .setDescription(truncateTo(res.description, 100))
          if (res.emoji) {
            const parse = getEmoji(interaction.client, res.emoji)
            if (parse) {
              builder.setEmoji(toAPIMessageComponentEmoji(parse))
            }
          }
          return builder
        })
    )

  await interaction.reply({
    components: [
      new ActionRowBuilder<SelectMenuBuilder>().addComponents(selectMenu)
    ],
    ephemeral: true,
    fetchReply: true
  })
}
