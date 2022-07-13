import {config} from './Config.js'
import {Client, Collection, Intents} from 'discord.js'
import {MarkedClient} from './MarkedClient.js'
import {logger} from './logging.js'
import {setupBranding} from './util/branding.js'
import * as storage from './store/storage.js'
import './util/random.js'
import ModuleManager from './modules/moduleManager.js'
import {HotTakesModule} from './modules/hotTakes/hotTakes.module.js'
import ImageForwarderModule from './modules/imageForwarder.module.js'
import {XpModule} from './modules/xp/xp.module.js'
import {TokenScannerModule} from './modules/tokenScanner.module.js'
import {RolesModule} from './modules/roles/roles.module.js'
import FaqModule from './modules/faq/faq.module.js'

const client = new Client({
	intents: [Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
}) as MarkedClient

const moduleManager = new ModuleManager(client,
	config.clientId,
	config.guildId,
	[
		FaqModule,
		HotTakesModule,
		ImageForwarderModule,
		RolesModule,
		TokenScannerModule,
		XpModule])

client.commands = new Collection()

async function logIn() {
	const token = process.env.BOT_TOKEN
	if (!token) {
		logger.crit('No token found')
		process.exit(1)
		return client
	}
	logger.info('Logging in')
	await client.login(process.env.BOT_TOKEN)
	logger.info('Logged in')
	return client
}

async function main() {
	await Promise.all([storage.init(), logIn().then(moduleManager.refreshCommands.bind(moduleManager))])
	const guild = await client.guilds.fetch(config.guildId)
	setupBranding(guild)
}

main()
