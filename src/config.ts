import {Snowflake} from "discord.js";

export type Config = { botCommandsChannelId: Snowflake; color: string }

export const config: Config = {
    color: "0xC6BFF7",
    botCommandsChannelId: '821820015917006868'
}