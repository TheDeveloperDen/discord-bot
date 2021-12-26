import {HexColorString, Snowflake} from "discord.js";

export type Config = { botCommandsChannelId: Snowflake; color: HexColorString, guildId: string, clientId: string }

export const config: Config = {
    color: "#0xC6BFF7",
    botCommandsChannelId: '906954540039938048',
    clientId: '904478222455029821',
    guildId: '904478147351806012'
}