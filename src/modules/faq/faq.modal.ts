import {FAQ} from '../../store/models/FAQ.js'
import {ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle} from 'discord.js'

export const createFaqModal = (faq?: FAQ) => {
    const modal = new ModalBuilder()
        .setTitle('FAQ Content')
        .setCustomId('faqContent')

    const titleField = new TextInputBuilder()
        .setCustomId('titleField')
        .setLabel('Title')
        .setMaxLength(64)
        .setStyle(TextInputStyle.Short)

    if (faq != null) {
        titleField.setValue(faq.title)
    }

    const contentField = new TextInputBuilder()
        .setCustomId('faqContentField')
        .setLabel('Content')
        .setStyle(TextInputStyle.Paragraph)

    if (faq != null) {
        contentField.setValue(faq.content)
    }

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleField)
    )
    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(contentField)
    )

    return modal
}

export default createFaqModal
