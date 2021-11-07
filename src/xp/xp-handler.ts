import {Client, MessageEmbedOptions, TextChannel, User} from "discord.js";
import {shouldCountForStats} from "./levelling";
import {config} from "../config";
import {xpForLevel, xpForMessage} from "./experience-calculations";
import {DDUser} from "../store/DDUser";
import {EventHandler} from "../EventHandler";

const xpHandler: EventHandler = (client) => {
    client.on('messageCreate', async msg => {
        if (!(msg.channel instanceof TextChannel)) {
            return
        }
        if (await shouldCountForStats(msg.author, msg.content, msg.channel, config)) {
            const xp = xpForMessage(msg.content);
            const [user] = await DDUser.findOrCreate({where: {id: msg.author.id}})
            if (!user) {
                console.error(`Could not find or create user with id ${msg.author.id}`)
                return
            }
            user.xp += xp
            await levelUp(client, msg.author, user)
            await user.update({xp: user.xp, level: user.level})
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
        title: `Level Up!`,
        description: `${user.username}, you leveled up to level **${ddUser.level}**!`,
        color: config.color,
        thumbnail: {
            url: user.avatarURL()
        },
        footer: "Don't want to be pinged? **/role No Ping**",
        timestamp: new Date(),
        fields: [
            {
                name: 'XP',
                value: `${ddUser.xp}/${xpForLevel(ddUser.level + 1)}`
            }
        ]
    } as MessageEmbedOptions
    await channel.send({content: `<@${user.id}>`, embeds: [embed]})
}

export default xpHandler;