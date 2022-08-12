import {config} from './Config.js'
import {Client, GatewayIntentBits} from 'discord.js'
import {logger} from './logging.js'
import {setupBranding} from './util/branding.js'
import './util/random.js'
import ModuleManager from './modules/moduleManager.js'
import {HotTakesModule} from './modules/hotTakes/hotTakes.module.js'
import ImageForwarderModule from './modules/imageForwarder.module.js'
import {XpModule} from './modules/xp/xp.module.js'
import {TokenScannerModule} from './modules/tokenScanner.module.js'
import {RolesModule} from './modules/roles/roles.module.js'
import FaqModule from './modules/faq/faq.module.js'
import PastifyModule from './modules/pastify/pastify.module.js'
import {ShowcaseModule} from './modules/showcase.module.js'
import {LanguageStatusModule} from './modules/languageStatus.module.js'
import AskToAskModule from './modules/askToAsk.module.js'
import JoinLeaveMessageModule from './modules/joinLeaveMessage.module.js'
import {CoreModule} from './modules/core/core.module.js'
import {LearningModule} from './modules/learning/learning.module.js'
import {InformationModule} from './modules/information/information.module.js'

const client = new Client({
	intents: [GatewayIntentBits.GuildMembers, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
})

export const moduleManager = new ModuleManager(client,
	config.clientId,
	config.guildId,
	[
		AskToAskModule,
		CoreModule,
		FaqModule,
		HotTakesModule,
		ImageForwarderModule,
		InformationModule,
		JoinLeaveMessageModule,
		LanguageStatusModule,
		LearningModule,
		PastifyModule,
		RolesModule,
		ShowcaseModule,
		TokenScannerModule,
		XpModule])

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
	await logIn()
	await moduleManager.refreshCommands()
	const guild = await client.guilds.fetch(config.guildId)
	setupBranding(guild)
}

main()
