import "../instrument.js";
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
import ModuleManager from "./modules/moduleManager.js";
import PastifyModule from "./modules/pastify/pastify.module.js";
import { ReactionStatsModule } from "./modules/reactionStats/reactionStats.module.js";
import { RolesModule } from "./modules/roles/roles.module.js";
import { ShowcaseModule } from "./modules/showcase.module.js";
import { StarboardModule } from "./modules/starboard/starboard.module.js";
import SuggestModule from "./modules/suggest/suggest.module.js";
import { ThreatDetectionModule } from "./modules/threatDetection/threatDetection.module.js";
import { TokenScannerModule } from "./modules/tokenScanner.module.js";
import { UserModule } from "./modules/user/user.module.js";
import { XpModule } from "./modules/xp/xp.module.js";

import { initStorage } from "./store/storage.js";
import { initSentry } from "./sentry.js";

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
	],
);

async function logIn() {
	initSentry(client);

	const token = process.env.DDB_BOT_TOKEN;
	if (!token) {
		logger.error("No token found");
		process.exit(1);
	}

	logger.info("Logging in...");
	await client.login(token);

	// ensure bot is fully ready
	await new Promise((resolve) => client.once("ready", resolve));

	logger.info("Logged in and ready");
	return client;
}

async function initModules() {
	for (const module of moduleManager.getModules()) {
		try {
			const result = module.onInit?.(moduleManager, client);

			if (result instanceof Promise) {
				await result;
			}
		} catch (e) {
			Sentry.captureException(e);
			logger.error(`Error initializing module ${module.name}`, e);
		}
	}
}

async function main() {
	await initStorage();

	await logIn();

	const guild = await client.guilds.fetch(config.guildId);
	await setupBranding(guild);

	await moduleManager.refreshCommands();

	await initModules();
}

// Graceful shutdown
async function shutdown() {
	console.log("Gracefully shutting down scheduled jobs");

	try {
		await schedule.gracefulShutdown();
		await client.destroy();
	} catch (e) {
		Sentry.captureException(e);
		logger.error("Error during shutdown", e);
	} finally {
		process.exit(0);
	}
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Bootstrap
(async () => {
	try {
		startHealthCheck();
		await main();
	} catch (e) {
		Sentry.captureException(e);
		logger.error("Fatal error in main()", e);
		throw e;
	}
})();
