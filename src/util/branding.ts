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

export const branding: Required<BrandingConfig> = {
    name: 'Developer Den',
    iconUrl: 'https://static.developerden.org/logo.png',
    ...config.branding
}

export async function setupBranding(guild: Guild) {
    guild = await guild.fetch()
    logger.debug(`Setting up branding with guild ${guild.name} and ${guild.iconURL()}`)
    branding.name = guild.name
    branding.iconUrl = guild.iconURL() ?? branding.iconUrl
    logger.debug(`Branding config set to ${JSON.stringify(branding)}`)
}
