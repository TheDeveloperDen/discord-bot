import {Command} from 'djs-slash-helper'
import {APIEmbed, ApplicationCommandType} from 'discord-api-types/v10'
import {config} from '../../Config.js'
import {ActionRowBuilder, ButtonBuilder} from 'discord.js'
import {createStandardEmbed} from '../../util/embeds.js'
import {CustomButton} from './information.js'
import {logger} from '../../logging.js'

function loadCustomButton(customButton: CustomButton) {
    if (customButton instanceof ButtonBuilder) {
        return customButton
    }
    switch (customButton.type) {
        case 'faq':
            return customButton.button.setCustomId(`faq-${customButton.faqId}`)
        case 'learning':
            return customButton.button.setCustomId('learning-resources')
    }
}

export const InformationMessageCommand: Command<ApplicationCommandType.Message> = {
    name: 'Set Information Message',
    default_permission: false,
    type: ApplicationCommandType.Message,
    async handle(interaction) {

        if (!interaction.targetMessage.editable) {
            await interaction.reply({ephemeral: true, content: 'I can\'t edit that message.'})
            return
        }

        if (!config.informationMessage) {
            await interaction.reply({ephemeral: true, content: 'There is no information message configured.'})
            return
        }
        const informationMessage = config.informationMessage
        const embed = {
            ...createStandardEmbed().data,
            ...informationMessage.embed.data
        } as APIEmbed
        const rows = informationMessage.buttonRows

        const newMessage = await interaction.targetMessage.edit({
            content: informationMessage.content ?? null,
            embeds: [embed],
            components: rows.map(row => {
                const rowEntries = row.map(loadCustomButton)
                return new ActionRowBuilder<ButtonBuilder>().addComponents(...rowEntries)
            })
        })


        logger.info(`Information message set for ${newMessage.id} with content ${newMessage.content} and embed ${JSON.stringify(newMessage.embeds[0])}`)
        await interaction.reply({ephemeral: true, content: 'Information message set.'})
    }
}


