import {config} from './Config.js'
import {Client, Collection, Intents} from 'discord.js'

import {MarkedClient} from './MarkedClient.js'
import {DDUser} from './store/models/DDUser.js'
import {EventHandler} from './EventHandler.js'
import xpHandler from './xp/xpHandler.js'
import {messageLoggerListener} from './listeners/messageLogger.js'
import {Command, commands} from './commands/Commands.js'
import {roleChangeListener} from './xp/roleUpdates.js'
import {SavedMessage} from './store/models/SavedMessage.js'
import {logger} from './logging.js'
import {loadCommands} from './deploy-commands.js'
import {bumpNotificationListener} from './listeners/bumpNotifications.js'
import {joinLeaveListener} from './listeners/joinLeaveMessages.js'
import {languageStatusListener} from './listeners/languageStatus.js'
import {pastebinListener} from './listeners/pastebin.js'
import {setupBranding} from './util/branding.js'
import {tokenScanner} from './listeners/tokenScanner.js'
import {hotTakeListener} from './hotTakeSender.js'
import {sequelize} from './store/storage.js'
import {ColourRoles} from "./store/models/ColourRoles.js";


const client = new Client({
	intents: [Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
}) as MarkedClient
client.commands = new Collection()


async function init() {
	const guild = await client.guilds.fetch(config.guildId)
	setupBranding(guild)
	await guild.commands.fetch()
	for (const command of commands) {
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

	const models = [DDUser, SavedMessage, ColourRoles]
	sequelize.addModels(models)
	for (const model of models) {
		await model.sync()
	}
})

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return
	const command = client.commands.get(interaction.commandName)
	if (!command) return
	await command.execute(interaction)
})

const registerListener = (events: EventHandler[]) => events.forEach(e => e(client))

function main() {
	registerListener([xpHandler,
		messageLoggerListener,
		roleChangeListener,
		bumpNotificationListener,
		joinLeaveListener,
		languageStatusListener,
		pastebinListener,
		tokenScanner,
		hotTakeListener])

	const token = process.env.BOT_TOKEN
	if (!token) {
		logger.error('No token found')
		process.exit(1)
		return
	}

	const firstTask = process.env.UPDATE_COMMANDS ? () => loadCommands(token, config) : () => Promise.resolve()

	firstTask()
		.then(() => client.login(token))
		.then(init)
}

main()
