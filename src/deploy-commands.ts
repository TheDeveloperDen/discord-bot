import {readdirSync} from "fs";
import {Command} from "./commands/Command";
import {REST} from "@discordjs/rest";
import {Routes} from "discord-api-types/v9";
import {Config} from "./config";

export async function loadCommands(token: string, config: Config) {
    const commandFiles = readdirSync('./src/commands')
        .filter(file => file.endsWith('.ts'))
        .filter(file => file != 'Command.ts')

    const commands = []
    for (const file of commandFiles) {
        const command: Command = require(`./commands/${file}`)
        commands.push(command.info.toJSON())
    }

    const rest = new REST({version: '9'}).setToken(token)
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {body: commands})

    console.log('Successfully reloaded application (/) commands.');
}

