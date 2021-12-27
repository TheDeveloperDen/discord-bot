import {EventHandler} from "./EventHandler.js";
import {getUserById} from "./store/models/DDUser.js";
import {logger} from "./logging.js";
import {config} from "./Config.js";
import {TextChannel} from "discord.js";


const disboardId = '302050872383242240'

export const bumpNotificationListener: EventHandler = (client) => {
    client.on('messageCreate', async message => {
        if (message.content !== '!bump') return;

        try {
            await message.channel.awaitMessages({
                filter: msg => msg.author.id == disboardId && (msg.embeds[0]?.description?.includes(':thumbsup:') ?? false),
                max: 1,
                time: 3000,
                errors: ['time']
            })
        } catch (e) {
            logger.error(e);
            return
        }

        const user = await getUserById(BigInt(message.author.id))
        user.bumps++
        await user.save()
        logger.debug(`Incremented bumps for ${message.author.username}`)
        setTimeout(async () => {
            const channel = await client.channels.fetch(config.botCommandsChannelId) as TextChannel
            await channel.send(`<@&${config.bumpNotificationRoleId}>, the server is ready to be bumped! **!d bump**"`)
        }, 1000 * 60 * 60 * 2)
    })
}