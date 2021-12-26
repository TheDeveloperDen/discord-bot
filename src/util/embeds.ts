import {config} from "../Config.js";
import {GuildMember} from "discord.js";

export const createStandardEmbed = (user?: GuildMember) => {
    return {
        color: user?.roles?.highest?.color ?? config.color,
        footer: 'Developer Den',
        author: {
            url: "https://developerden.net/logo.png"
        },
        timestamp: new Date(),
    }
}

