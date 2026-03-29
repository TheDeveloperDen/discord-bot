import { type GuildMember, type Interaction, MessageFlags } from "discord.js";
import { getResourceEmbed } from "../learning/learning.command.js";
import { getResource } from "../learning/resourcesCache.util.js";
import type { EventListener } from "../module.js";
import {
	applyAnswer,
	computeResults,
	createQuizSession,
	getNextQuestion,
	skipQuestion,
} from "./engine/quiz.js";
import type { QuizResult, QuizSession } from "./engine/types.js";
import {
	makeId,
	renderLearningResourcesSelect,
	renderQuestionMessage,
	renderResultsMessage,
	renderShareEmbed,
} from "./recommender.render.js";

// ─── Session storage ─────────────────────────────────────────────────────────

interface StoredSession {
	session: QuizSession;
	result?: QuizResult;
	userId: string;
	createdAt: number;
}

const sessions = new Map<string, StoredSession>();

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

/** Generate an 8-char session key from user and interaction IDs. */
function generateSessionKey(userId: string, interactionId: string): string {
	// Simple hash: take parts of both IDs
	const combined = `${userId}:${interactionId}`;
	let hash = 0;
	for (let i = 0; i < combined.length; i++) {
		const char = combined.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return Math.abs(hash).toString(36).padStart(8, "0").slice(0, 8);
}

/** Create a session and return the session key. */
export function createSession(
	userId: string,
	interactionId: string,
	session: QuizSession,
): string {
	// Remove any existing session for this user
	for (const [key, stored] of sessions) {
		if (stored.userId === userId) {
			sessions.delete(key);
		}
	}

	const sessionKey = generateSessionKey(userId, interactionId);
	sessions.set(sessionKey, {
		session,
		userId,
		createdAt: Date.now(),
	});
	return sessionKey;
}

function cleanupExpiredSessions() {
	const now = Date.now();
	for (const [key, stored] of sessions) {
		if (now - stored.createdAt > SESSION_TTL_MS) {
			sessions.delete(key);
		}
	}
}

/** Start the cleanup interval. Call from module onInit. */
export function startSessionCleanup(): NodeJS.Timeout {
	return setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);
}

// ─── Custom ID parsing ──────────────────────────────────────────────────────

interface ParsedId {
	sessionKey: string;
	action: string;
	payload?: string;
}

function parseCustomId(customId: string): ParsedId | null {
	if (!customId.startsWith("wl:")) return null;
	const parts = customId.split(":");
	if (parts.length < 3) return null;
	return {
		sessionKey: parts[1],
		action: parts[2],
		payload: parts[3],
	};
}

// ─── Event listener ──────────────────────────────────────────────────────────

export const RecommenderListener: EventListener = {
	async interactionCreate(_client, interaction: Interaction) {
		if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

		const parsed = parseCustomId(interaction.customId);
		if (!parsed) return;

		const stored = sessions.get(parsed.sessionKey);
		if (!stored) {
			if (interaction.isButton()) {
				await interaction.reply({
					content:
						"This quiz session has expired. Use `/whatlang` to start a new one!",
					flags: MessageFlags.Ephemeral,
					withResponse: false,
				});
			}
			return;
		}

		// Verify the user owns this session
		if (stored.userId !== interaction.user.id) return;

		switch (parsed.action) {
			case "answer":
				await handleAnswer(interaction, stored, parsed);
				break;
			case "scale":
				await handleScale(interaction, stored, parsed);
				break;
			case "select":
				await handleSelect(interaction, stored, parsed);
				break;
			case "skip":
				await handleSkip(interaction, stored, parsed);
				break;
			case "restart":
				await handleRestart(interaction, stored, parsed);
				break;
			case "resources":
				await handleResources(interaction, stored, parsed);
				break;
			case "learn-pick":
				await handleLearnPick(interaction, stored);
				break;
			case "share":
				await handleShare(interaction, stored);
				break;
		}
	},
};

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleAnswer(
	interaction: Interaction,
	stored: StoredSession,
	parsed: ParsedId,
) {
	if (!interaction.isButton()) return;
	if (!parsed.payload) return;

	const currentQuestion = getNextQuestion(stored.session);
	if (!currentQuestion) return;

	const newSession = applyAnswer(stored.session, {
		questionId: currentQuestion.id,
		selectedOptionIds: [parsed.payload],
	});

	stored.session = newSession;
	await advanceOrFinish(interaction, stored, parsed.sessionKey);
}

async function handleScale(
	interaction: Interaction,
	stored: StoredSession,
	parsed: ParsedId,
) {
	if (!interaction.isButton()) return;
	if (!parsed.payload) return;

	const currentQuestion = getNextQuestion(stored.session);
	if (!currentQuestion) return;

	const newSession = applyAnswer(stored.session, {
		questionId: currentQuestion.id,
		selectedOptionIds: [parsed.payload],
	});

	stored.session = newSession;
	await advanceOrFinish(interaction, stored, parsed.sessionKey);
}

async function handleSelect(
	interaction: Interaction,
	stored: StoredSession,
	parsed: ParsedId,
) {
	if (!interaction.isStringSelectMenu()) return;

	const currentQuestion = getNextQuestion(stored.session);
	if (!currentQuestion) return;

	const newSession = applyAnswer(stored.session, {
		questionId: currentQuestion.id,
		selectedOptionIds: interaction.values,
	});

	stored.session = newSession;
	await advanceOrFinish(interaction, stored, parsed.sessionKey);
}

async function handleSkip(
	interaction: Interaction,
	stored: StoredSession,
	parsed: ParsedId,
) {
	if (!interaction.isButton()) return;
	if (!parsed.payload) return;

	const newSession = skipQuestion(stored.session, parsed.payload);
	stored.session = newSession;
	await advanceOrFinish(interaction, stored, parsed.sessionKey);
}

async function handleRestart(
	interaction: Interaction,
	stored: StoredSession,
	parsed: ParsedId,
) {
	if (!interaction.isButton()) return;

	const newSession = createQuizSession();
	const question = getNextQuestion(newSession);
	if (!question) return;

	stored.session = newSession;
	stored.result = undefined;
	stored.createdAt = Date.now();

	const message = renderQuestionMessage(
		question,
		newSession,
		parsed.sessionKey,
	);
	await interaction.update(message);
}

async function handleResources(
	interaction: Interaction,
	stored: StoredSession,
	parsed: ParsedId,
) {
	if (!interaction.isButton()) return;

	const result = stored.result ?? computeResults(stored.session);
	stored.result = result;

	const hasResources = result.recommendations.some(
		(r) =>
			r.target.learningResourceIds && r.target.learningResourceIds.length > 0,
	);

	if (!hasResources) {
		await interaction.reply({
			content: "No learning resources available for these recommendations yet.",
			flags: MessageFlags.Ephemeral,
			withResponse: false,
		});
		return;
	}

	const selectRow = renderLearningResourcesSelect(result, parsed.sessionKey);
	await interaction.reply({
		content: "Select a language to view its learning resources:",
		components: [selectRow],
		flags: MessageFlags.Ephemeral,
		withResponse: false,
	});
}

async function handleLearnPick(
	interaction: Interaction,
	stored: StoredSession,
) {
	if (!interaction.isStringSelectMenu()) return;

	const resourceId = interaction.values[0];
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const resource = await getResource(resourceId);
	if (!resource) {
		await interaction.followUp({
			content: `Could not find learning resource "${resourceId}". It may not be available yet.`,
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const embed = getResourceEmbed(
		interaction.client,
		resource,
		interaction.user,
		(interaction.member as GuildMember) ?? undefined,
	);

	await interaction.followUp({
		embeds: [embed],
		flags: MessageFlags.Ephemeral,
	});
}

async function handleShare(interaction: Interaction, stored: StoredSession) {
	if (!interaction.isButton()) return;

	const result = stored.result ?? computeResults(stored.session);
	stored.result = result;

	if (result.recommendations.length === 0) {
		await interaction.reply({
			content: "No results to share.",
			flags: MessageFlags.Ephemeral,
			withResponse: false,
		});
		return;
	}

	const embed = renderShareEmbed(result, interaction.user);
	await interaction.reply({
		embeds: [embed],
		withResponse: false,
	});
}

// ─── Flow control ────────────────────────────────────────────────────────────

async function advanceOrFinish(
	interaction: Interaction,
	stored: StoredSession,
	sessionKey: string,
) {
	if (!("update" in interaction) || typeof interaction.update !== "function")
		return;

	if (stored.session.completed) {
		const result = computeResults(stored.session);
		stored.result = result;

		const message = renderResultsMessage(
			result,
			sessionKey,
			interaction.user,
			(interaction.member as GuildMember) ?? undefined,
		);
		await interaction.update(message);
	} else {
		const nextQuestion = getNextQuestion(stored.session);
		if (!nextQuestion) return;

		const message = renderQuestionMessage(
			nextQuestion,
			stored.session,
			sessionKey,
		);
		await interaction.update(message);
	}
}
