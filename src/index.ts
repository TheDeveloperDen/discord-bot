import "../instrument.js"; // Import the instrumentation module first
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./Config.js";
import { setupBranding } from "./util/branding.js";
import "./util/random.js";
import * as Sentry from "@sentry/bun";
import * as schedule from "node-schedule";
import { startHealthCheck } from "./healthcheck.js";
import { logger } from "./logging.js";
import { AchievementsModule } from "./modules/achievements/achievements.module.js";
import AskToAskModule from "./modules/askToAsk.module.js";
import { CoreModule } from "./modules/core/core.module.js";
import FaqModule from "./modules/faq/faq.module.js";
import { HotTakesModule } from "./modules/hotTakes/hotTakes.module.js";
import ImageForwarderModule from "./modules/imageForwarder.module.js";
import { InformationModule } from "./modules/information/information.module.js";
import JoinLeaveMessageModule from "./modules/joinLeaveMessage.module.js";
import { LanguageStatusModule } from "./modules/languageStatus.module.js";
import LeaderboardModule from "./modules/leaderboard/leaderboard.module.js";
import { LearningModule } from "./modules/learning/learning.module.js";
import { ModerationModule } from "./modules/moderation/moderation.module.js";
import { ModmailModule } from "./modules/modmail/modmail.module.js";
import ModuleManager, { setModuleManager } from "./modules/moduleManager.js";
import PastifyModule from "./modules/pastify/pastify.module.js";
import { ReactionStatsModule } from "./modules/reactionStats/reactionStats.module.js";
import { RecommenderModule } from "./modules/recommender/recommender.module.js";
import { RolesModule } from "./modules/roles/roles.module.js";
import { ShowcaseModule } from "./modules/showcase.module.js";
import { StarboardModule } from "./modules/starboard/starboard.module.js";
import SuggestModule from "./modules/suggest/suggest.module.js";
import { ThreatDetectionModule } from "./modules/threatDetection/threatDetection.module.js";
import { TokenScannerModule } from "./modules/tokenScanner.module.js";
import { UserModule } from "./modules/user/user.module.js";
import { XpModule } from "./modules/xp/xp.module.js";
import { initSentry } from "./sentry.js";
import { initStorage } from "./store/storage.js";

const client = new Client({
	intents: [
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages,
	],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const moduleManager = new ModuleManager(
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
		XpModule,
		SuggestModule,
		ModerationModule,
		StarboardModule,
		ModmailModule,
		LeaderboardModule,
		UserModule,
		AchievementsModule,
		ThreatDetectionModule,
		ReactionStatsModule,
		RecommenderModule,
	],
);

setModuleManager(moduleManager);

async function logIn() {
	initSentry(client);
	const token = process.env.DDB_BOT_TOKEN;
	if (!token) {
		logger.error("No token found");
		process.exit(1);
	}
	logger.info("Logging in");
	await client.login(token);
	logger.info("Logged in");
	return client;
}

async function main() {
	await initStorage();
	await moduleManager.preInit();
	await logIn();
	const guild = await client.guilds.fetch(config.guildId);
	await setupBranding(guild);

	await moduleManager.refreshCommands();
	await moduleManager.init();
	logger.info("Startup complete");
}

const processEvents: NodeJS.EventEmitter = process;

async function shutdown(signal: NodeJS.Signals) {
	logger.info(`Received ${signal}, shutting down`);
	await schedule.gracefulShutdown();
	await client.destroy();
	await Sentry.close(2000);
	process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	processEvents.once(signal, () => void shutdown(signal));
}

try {
	startHealthCheck();
	await main();
} catch (e) {
	Sentry.captureException(e);
	throw e;
}
