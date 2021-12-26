import {config} from "./Config.js";
import {Client, Collection, Intents} from "discord.js";

import {MarkedClient} from "./MarkedClient.js";

import {loadCommands} from "./deploy-commands.js";
import {Users} from "./store/models/DDUser.js";
import {EventHandler} from "./EventHandler.js";
import xpHandler from "./xp/xpHandler.js";
import {messageLoggerListener} from "./xp/messageLogger.js";
import {commands} from "./commands/Commands.js";
import {roleChangeListener} from "./xp/roleUpdates.js";
import {SavedMessage} from "./store/models/SavedMessage.js";

// @ts-ignore
const client: MarkedClient = new Client({
    intents: [Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
})
client.commands = new Collection();


for (const commandType of commands) {
    const command = new commandType()
    client.commands.set(command.info.name, command)
    console.log(`Loaded command: ${command.info.name}`)
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}`)

    await Users.sync()
    await SavedMessage.sync()
})

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const command = client.commands.get(interaction.commandName)
    if (!command) return;
    await command.execute(interaction)
})

const registerListener = (events: EventHandler[]) => events.forEach(e => e(client))

registerListener([xpHandler, messageLoggerListener, roleChangeListener])

const token = process.env.BOT_TOKEN!!;

loadCommands(token, config)
    .then(() => client.login(token))