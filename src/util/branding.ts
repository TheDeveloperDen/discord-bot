import {Guild, GuildMember, PartialGuildMember} from 'discord.js'
import {config} from '../Config.js'
import {logger} from "../logging.js";

export interface BrandingConfig {
    name?: string
    iconUrl?: string
    welcomeMessage: (member: GuildMember | PartialGuildMember) => string
    goodbyeMessage: (member: GuildMember | PartialGuildMember) => string
    font: string
    color: string
}

export let branding: Required<BrandingConfig> = {
    name: 'Developer Den',
    iconUrl: 'https://developerden.net/logo.png',
    ...config.branding
}

export async function setupBranding(guild: Guild) {
    guild = await guild.fetch()
    logger.debug(`Setting up branding with guild ${guild.name} and ${guild.iconURL()}`)
    branding = {
        ...{
            name: guild.name ?? 'Developer Den',
            iconUrl: guild.iconURL() ??
                'https://cdn.discordapp.com/embed/avatars/0.png'
        },
        ...config.branding
    }
}
