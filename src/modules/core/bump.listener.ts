import {EventListener} from "../module.js";
import {ChannelType, InteractionType} from "discord-api-types/v10";
import {getOrCreateUserById} from "../../store/models/DDUser.js";
import {logger} from "../../logging.js";
import {config} from "../../Config.js";

export const BumpListener: EventListener = {
    messageCreate: async (client, message) => {
        const interaction = message.interactionMetadata
        if (!interaction || !(interaction.type == InteractionType.ApplicationCommand)) return
        if (interaction.id != '947088344167366698') return // /bump id

        // since the bump failed message is ephemeral, we know if we can see the message then the bump succeeded!
        const ddUser = await getOrCreateUserById(BigInt(message.author.id))

        ddUser.bumps += 1
        logger.info(`User ${message.author.tag} bumped! Total bumps: ${ddUser.bumps}`)
        await ddUser.save()

        setTimeout(async () => {
            const botCommands = await client.channels.fetch(config.channels.botCommands)
            if (!botCommands) {
                logger.error('Bot commands channel not found')
                return
            }
            if (botCommands.type != ChannelType.GuildText) {
                logger.error('Bot commands channel is not a text channel')
                return
            }

            const bumpNotificationsRoleId = config.roles.bumpNotifications;
            if (!bumpNotificationsRoleId) {
                logger.error('Bump notifications role not found')
                return
            }
            const bumpNotificationsRole = await message.guild?.roles.fetch(bumpNotificationsRoleId)

            if (!bumpNotificationsRole) {
                logger.error('Bump notifications role not found')
                return
            }

            await botCommands.send({
                content: `<@&${bumpNotificationsRole}>, The server is ready to be bumped! </bump:947088344167366698>`
            })


        }, 60 * 60 * 1000 * 2) // 2 hours

    }
}
