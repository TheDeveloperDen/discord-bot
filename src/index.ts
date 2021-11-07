import {config} from "./config";
import {Client, Collection, Intents} from "discord.js";

import {MarkedClient} from "./MarkedClient";
import {readdirSync} from "fs";
import {Command} from "./commands/Command";
import {loadCommands} from "./deploy-commands";
import {Users} from "./store/DDUser";
import {EventHandler} from "./EventHandler";
import xpHandler from "./xp/xp-handler";
import {previousMessageListener} from "./xp/previous-messages";

// @ts-ignore
const client: MarkedClient = new Client({
    intents: [Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
})
client.commands = new Collection();

const commandFiles = readdirSync('./src/commands')
    .filter(file => file.endsWith('.ts'))
    .filter(file => file != 'Command.ts')

for (const file of commandFiles) {
    const command: Command = require(`./commands/${file}`)
    client.commands.set(command.info.name, command)
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}`)

    await Users.sync()
})

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const command = client.commands.get(interaction.commandName)
    if (!command) return;
    await command.execute(interaction)
})


const registerListener = (events: EventHandler[]) => events.forEach(e => e(client))

registerListener([xpHandler, previousMessageListener])

const token = process.env.BOT_TOKEN!!;

loadCommands(token, config)
    .then(() => client.login(token))