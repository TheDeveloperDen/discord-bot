import {config} from "./Config.js";
import {Client, Collection, Intents} from "discord.js";

import {MarkedClient} from "./MarkedClient.js";
import {Users} from "./store/models/DDUser.js";
import {EventHandler} from "./EventHandler.js";
import xpHandler from "./xp/xpHandler.js";
import {messageLoggerListener} from "./xp/messageLogger.js";
import {Command, commands} from "./commands/Commands.js";
import {roleChangeListener} from "./xp/roleUpdates.js";
import {SavedMessage} from "./store/models/SavedMessage.js";
import {logger} from "./logging.js";
import {loadCommands} from "./deploy-commands.js";
import {bumpNotificationListener} from "./bumpNotifications.js";

// @ts-ignore
const client: MarkedClient = new Client({
    intents: [Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
})
client.commands = new Collection();


async function init() {
    const guild = await client.guilds.fetch(config.guildId)
    await guild.commands.fetch()
    for (const commandType of commands) {
        const command = new commandType() as Command

        const slash = guild.commands.cache.find(cmd => cmd.name == command.info.name)
        if (!slash) {
            logger.error(`Command ${command.info.name} not found in guild ${config.guildId}`)
            continue
        }
        await command.init?.(slash)
        client.commands.set(command.info.name, command)
        logger.info(`Loaded command: ${command.info.name}`)
    }

}

client.once('ready', async () => {
    logger.info(`Logged in as ${client.user?.tag}`)

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

registerListener([xpHandler, messageLoggerListener, roleChangeListener, bumpNotificationListener])

const token = process.env.BOT_TOKEN!!;

const firstTask = process.env.UPDATE_COMMANDS ? () => loadCommands(token, config) : () => Promise.resolve()
// loadCommands(token, config)
firstTask()
    .then(() => client.login(token))
    .then(init)