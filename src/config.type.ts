import { Snowflake } from 'discord.js'
import { BrandingConfig } from './util/branding.js'
import { InformationMessage } from './modules/information/information.js'

export interface Config {
  guildId: string
  clientId: string
  poll?: {
    emojiId: string
    yesEmojiId: string
    noEmojiId: string
  }
  pastebin: { url: string, threshold: number }
  channels: {
    welcome: string
    botCommands: string
    hotTake: string
    showcase: string
    auditLog: string
  }
  commands: {
    daily: Snowflake
  }
  roles: {
    tiers: Snowflake[]
    admin: Snowflake
    notable?: Snowflake
    staff: Snowflake
    separators: { general: Snowflake, tags: Snowflake, langs: Snowflake }
    noPing: Snowflake
    bumpNotifications?: Snowflake
  }
  branding: BrandingConfig
  informationMessage?: InformationMessage
}
