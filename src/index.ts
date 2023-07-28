import { config } from './Config.js'
import * as dotenv from 'dotenv'
import { Client, GatewayIntentBits, Partials } from 'discord.js'
import { setupBranding } from './util/branding.js'
import './util/random.js'
import ModuleManager from './modules/moduleManager.js'
import { HotTakesModule } from './modules/hotTakes/hotTakes.module.js'
import ImageForwarderModule from './modules/imageForwarder.module.js'
import { XpModule } from './modules/xp/xp.module.js'
import { TokenScannerModule } from './modules/tokenScanner.module.js'
import { RolesModule } from './modules/roles/roles.module.js'
import FaqModule from './modules/faq/faq.module.js'
import PastifyModule from './modules/pastify/pastify.module.js'
import { ShowcaseModule } from './modules/showcase.module.js'
import { LanguageStatusModule } from './modules/languageStatus.module.js'
import AskToAskModule from './modules/askToAsk.module.js'
import JoinLeaveMessageModule from './modules/joinLeaveMessage.module.js'
import { CoreModule } from './modules/core/core.module.js'
import { InformationModule } from './modules/information/information.module.js'
import { LearningModule } from './modules/learning/learning.module.js'
import * as Sentry from '@sentry/node'
import { initStorage } from './store/storage.js'
import { initSentry } from './sentry.js'
import { logger } from './logging.js'

const client = new Client({
  intents: [
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
})

export const moduleManager = new ModuleManager(
  client,
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
    XpModule
  ]
)

async function logIn () {
  initSentry(client)
  const token = process.env.DDB_BOT_TOKEN
  if (!token) {
    logger.error('No token found')
    process.exit(1)
  }
  logger.info('Logging in')
  await client.login(token)
  logger.info('Logged in')
  return client
}

async function main () {
  dotenv.config()
  await initStorage()
  await logIn()
  await moduleManager.refreshCommands()

  for (const module of moduleManager.getModules()) {
    module.onInit?.(client)?.catch((e) => {
      Sentry.captureException(e)
      logger.error(`Error initializing module ${module.name}`, e)
    })
  }
  const guild = await client.guilds.fetch(config.guildId)
  setupBranding(guild)
}

try {
  await main()
} catch (e) {
  Sentry.captureException(e)
  throw e
}
