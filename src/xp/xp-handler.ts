import {Client, MessageEmbedOptions, TextChannel, User} from "discord.js";
import {shouldCountForStats} from "./levelling";
import {config} from "../config";
import {xpForLevel, xpForMessage} from "./experienceCalculations";
import {DDUser, getUserById} from "../store/DDUser";
import {EventHandler} from "../EventHandler";
import {createStandardEmbed} from "../util/embeds";

const xpHandler: EventHandler = (client) => {
    client.on('messageCreate', async msg => {
        if (!(msg.channel instanceof TextChannel)) {
            return
        }
        if (await shouldCountForStats(msg.author, msg, msg.channel, config)) {
            const xp = xpForMessage(msg.content);
            const user = await getUserById(BigInt(msg.author.id))
            if (!user) {
                console.error(`Could not find or create user with id ${msg.author.id}`)
                return
            }
            user.xp += xp
            await levelUp(client, msg.author, user)
            await user.save()
            console.log(`Gave ${xp} XP to user ${user.id} for message ${msg.id}`)
        }
    })
}

const levelUp = async (client: Client, user: User, ddUser: DDUser) => {
    let level = ddUser.level;
    while (xpForLevel(level) <= ddUser.xp) {
        level++
    }
    if (level == ddUser.level) {
        return
    }
    ddUser.level = level
    await sendLevelUpMessage(client, user, ddUser)
}

const sendLevelUpMessage = async (client: Client, user: User, ddUser: DDUser) => {

    const channel = await client.channels.fetch(config.botCommandsChannelId) as TextChannel
    if (!channel) {
        console.error(`Could not find level up channel with id ${config.botCommandsChannelId}`)
        return
    }
    const embed = {
        ...createStandardEmbed(),
        title: `Level Up!`,
        footer: 'Don\'t want to be pinged? **/role No Ping**',
        fields: [
            {
                name: 'XP',
                value: `${ddUser.xp}/${xpForLevel(ddUser.level + 1)}`
            }],
        description: `${user.username}, you leveled up to level **${ddUser.level}**!`
    } as MessageEmbedOptions
    await channel.send({content: `<@${user.id}>`, embeds: [embed]})
}

export default xpHandler;