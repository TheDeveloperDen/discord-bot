import {
	Sequelize,
	type Dialect,
	type SequelizeOptions,
} from "@sequelize/core";
import { SqliteDialect } from "@sequelize/sqlite3";
import { logger } from "../logging.js";

import { AntiStarboardMessage } from "./models/AntiStarboardMessage.js";
import { BlockedWord } from "./models/BlockedWord.js";
import { Bump } from "./models/Bump.js";
import { ColourRoles } from "./models/ColourRoles.js";
import { DDUser } from "./models/DDUser.js";
import { DDUserAchievements } from "./models/DDUserAchievements.js";
import { FAQ } from "./models/FAQ.js";
import { ModeratorActions } from "./models/ModeratorActions.js";
import { ModMailNote } from "./models/ModMailNote.js";
import { ModMailTicket } from "./models/ModMailTicket.js";
import { ReactionStat } from "./models/ReactionStat.js";
import { ReputationEvent } from "./models/ReputationEvent.js";
import { ScamDomain } from "./models/ScamDomain.js";
import { StarboardMessage } from "./models/StarboardMessage.js";
import { Suggestion } from "./models/Suggestion.js";
import { SuggestionVote } from "./models/SuggestionVote.js";
import { ThreatLog } from "./models/ThreatLog.js";
import { Warning } from "./models/Warning.js";

function sequelizeLog(sql: string, timing?: number) {
	if (typeof timing === "number") {
		if (timing >= 100) {
			logger.warn(`Slow query (${timing}ms): ${sql}`);
		}
	} else {
		logger.debug(sql);
	}
}

let sequelizeInstance: Sequelize | null = null;

export async function initStorage() {
	// idempotent init
	if (sequelizeInstance) return;

	const database = process.env.DDB_DATABASE ?? "database";
	const username = process.env.DDB_USERNAME ?? "root";
	const password = process.env.DDB_PASSWORD ?? "password";
	const host = process.env.DDB_HOST;
	const port = Number(process.env.DDB_PORT ?? 5432);
	const dialect = (process.env.DDB_DIALECT ?? "postgres") as Dialect;

	let sequelize: Sequelize;

	if (host) {
		// FIX: correct Sequelize constructor typing (no generic misuse)
		const config: SequelizeOptions = {
			dialect,
			database,
			username,
			password,
			host,
			port,
			logging: sequelizeLog,
			benchmark: true,
		};

		sequelize = new Sequelize(config);
	} else {
		sequelize = new Sequelize({
			dialect: SqliteDialect,
			storage: ":memory:",
			pool: {
				max: 1,
				idle: Infinity,
			},
			logging: sequelizeLog,
			benchmark: true,
		});
	}

	try {
		await sequelize.authenticate();
	} catch (err) {
		logger.error("Database authentication failed", err);
		throw err;
	}

	const models = [
		DDUser,
		ColourRoles,
		FAQ,
		Bump,
		StarboardMessage,
		AntiStarboardMessage,
		ModeratorActions,
		Suggestion,
		SuggestionVote,
		ModMailTicket,
		ModMailNote,
		DDUserAchievements,
		ThreatLog,
		ScamDomain,
		Warning,
		BlockedWord,
		ReputationEvent,
		ReactionStat,
	];

	sequelize.addModels(models);

	// FIX: safe association handling (prevents silent crashes if models not loaded)
	if (sequelize.models.DDUser && sequelize.models.Bump) {
		sequelize.models.Bump.belongsTo(sequelize.models.DDUser, {
			foreignKey: "userId",
			as: "user",
		});

		sequelize.models.DDUser.hasMany(sequelize.models.Bump, {
			foreignKey: "userId",
			as: "Bumps",
		});
	}

	try {
		await sequelize.sync();
	} catch (err) {
		logger.error("Database sync failed", err);
		throw err;
	}

	sequelizeInstance = sequelize;
	logger.info("Initialised database");
}

export function getSequelizeInstance() {
	if (!sequelizeInstance) {
		throw new Error("Storage not initialized. Call initStorage() first.");
	}
	return sequelizeInstance;
}
