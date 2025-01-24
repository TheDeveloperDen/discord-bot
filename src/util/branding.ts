import {Guild, GuildMember, PartialGuildMember} from 'discord.js'
import {config} from '../Config.js'

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

export function setupBranding(guild: Guild) {
    branding = {
        ...{
            name: guild.name ?? 'Developer Den',
            iconUrl: guild.iconURL() ??
                'https://cdn.discordapp.com/embed/avatars/0.png'
        },
        ...config.branding
    }
}
