import {FAQ} from '../../store/models/FAQ.js'
import {EmbedBuilder, GuildMember, User} from 'discord.js'
import {createStandardEmbed, standardFooter} from '../../util/embeds.js'
import {fakeMention} from '../../util/users.js'

export function createFaqEmbed(
    faq: FAQ,
    requester?: User,
    user?: GuildMember
): EmbedBuilder {
    return createStandardEmbed(user)
        .setTitle(faq.title)
        .setDescription(faq.content)
        .setFooter(
            {
                ...standardFooter(),
                text: (requester != null)
                    ? `Requested by ${
                        fakeMention(
                            requester
                        )
                    } | ${faq.name}`
                    : faq.name
            }
        )
}
