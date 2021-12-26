import {config} from "../Config.js";
import {GuildMember} from "discord.js";

export const createStandardEmbed = (user?: GuildMember) => {
    return {
        color: user?.roles?.color?.hexColor ?? config.color,
        footer: 'Developer Den',
        thumbnail: {url: "https://developerden.net/static/logo.png"},
        timestamp: new Date(),
    }
}

