import {REST} from "@discordjs/rest";
import {Routes} from "discord-api-types/v9";
import {Config} from "./Config.js";
import {commands} from "./commands/Commands.js";



export async function loadCommands(token: string, config: Config) {

    const commandsToRegister = commands
        .map(type => new type())
        .map(command => command.info.toJSON());

    const rest = new REST({version: '9'}).setToken(token)
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {body: commandsToRegister})

    console.log(`Successfully reloaded application (/) commands : ${commands.map(it => it.name)}`);
}

