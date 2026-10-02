import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type EmbedBuilder,
	type GuildMember,
	type InteractionReplyOptions,
	type InteractionUpdateOptions,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	type User,
} from "discord.js";
import { createStandardEmbed } from "../../util/embeds.js";
import { getApplicableQuestionCount } from "./engine/quiz.js";
import type {
	Question,
	QuizResult,
	QuizSession,
	RecommendationResult,
} from "./engine/types.js";

// ─── Custom ID helpers ───────────────────────────────────────────────────────

export function makeId(
	sessionKey: string,
	action: string,
	payload?: string,
): string {
	return payload
		? `wl:${sessionKey}:${action}:${payload}`
		: `wl:${sessionKey}:${action}`;
}

// ─── Question rendering ──────────────────────────────────────────────────────

export function renderQuestionMessage(
	question: Question,
	session: QuizSession,
	sessionKey: string,
): InteractionReplyOptions & InteractionUpdateOptions {
	const totalQuestions = getApplicableQuestionCount(session);
	const currentIndex = session.answers.length + 1;

	const embed = createStandardEmbed()
		.setTitle("What Language Should You Learn?")
		.setDescription(buildQuestionDescription(question))
		.setFooter({ text: `Question ${currentIndex} of ${totalQuestions}` });

	const components = buildQuestionComponents(question, sessionKey);

	// Add utility row (skip + restart)
	const utilityRow = new ActionRowBuilder<ButtonBuilder>();
	if (question.skippable) {
		utilityRow.addComponents(
			new ButtonBuilder()
				.setCustomId(makeId(sessionKey, "skip", question.id))
				.setLabel("Skip")
				.setStyle(ButtonStyle.Secondary),
		);
	}
	utilityRow.addComponents(
		new ButtonBuilder()
			.setCustomId(makeId(sessionKey, "restart"))
			.setLabel("Start Over")
			.setStyle(ButtonStyle.Danger),
	);
	components.push(utilityRow);

	return { embeds: [embed], components };
}

function buildQuestionDescription(question: Question): string {
	let desc = `**${question.text}**`;

	if (question.type === "scale" && question.scaleLabels) {
		desc += `\n\n1️⃣ ${question.scaleLabels[0]}\n5️⃣ ${question.scaleLabels[1]}`;
	}

	if (question.type === "multi") {
		desc += "\n\n*You can select multiple options.*";
	}

	return desc;
}

function buildQuestionComponents(
	question: Question,
	sessionKey: string,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
	if (question.type === "scale") {
		return buildScaleButtons(question, sessionKey);
	}

	if (question.type === "multi" || question.options.length > 5) {
		return buildSelectMenu(question, sessionKey);
	}

	return buildOptionButtons(question, sessionKey);
}

function buildOptionButtons(
	question: Question,
	sessionKey: string,
): ActionRowBuilder<ButtonBuilder>[] {
	const rows: ActionRowBuilder<ButtonBuilder>[] = [];
	let currentRow = new ActionRowBuilder<ButtonBuilder>();

	for (const option of question.options) {
		if (currentRow.components.length >= 5) {
			rows.push(currentRow);
			currentRow = new ActionRowBuilder<ButtonBuilder>();
		}

		const btn = new ButtonBuilder()
			.setCustomId(makeId(sessionKey, "answer", option.id))
			.setLabel(option.label)
			.setStyle(ButtonStyle.Primary);

		if (option.emoji) {
			btn.setEmoji(option.emoji);
		}

		currentRow.addComponents(btn);
	}

	if (currentRow.components.length > 0) {
		rows.push(currentRow);
	}

	return rows;
}

function buildScaleButtons(
	_question: Question,
	sessionKey: string,
): ActionRowBuilder<ButtonBuilder>[] {
	const scaleEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
	const row = new ActionRowBuilder<ButtonBuilder>();

	for (let i = 1; i <= 5; i++) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(makeId(sessionKey, "scale", String(i)))
				.setLabel(String(i))
				.setEmoji(scaleEmojis[i - 1])
				.setStyle(ButtonStyle.Primary),
		);
	}

	return [row];
}

function buildSelectMenu(
	question: Question,
	sessionKey: string,
): ActionRowBuilder<StringSelectMenuBuilder>[] {
	const menu = new StringSelectMenuBuilder()
		.setCustomId(makeId(sessionKey, "select"))
		.setPlaceholder("Choose an option...");

	if (question.type === "multi") {
		menu.setMinValues(1).setMaxValues(question.options.length);
	}

	menu.setOptions(
		question.options.map((opt) => {
			const builder = new StringSelectMenuOptionBuilder()
				.setLabel(opt.label)
				.setValue(opt.id);

			if (opt.description) {
				builder.setDescription(opt.description);
			}
			if (opt.emoji) {
				builder.setEmoji(opt.emoji);
			}

			return builder;
		}),
	);

	return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

// ─── Results rendering ───────────────────────────────────────────────────────

const rankEmojis = ["🥇", "🥈", "🥉"];

export function renderResultsMessage(
	result: QuizResult,
	sessionKey: string,
	user?: User,
	member?: GuildMember,
): InteractionReplyOptions & InteractionUpdateOptions {
	const embed = createStandardEmbed(member ?? user).setTitle(
		"Your Top Matches",
	);

	// Build ranked list
	const description = result.recommendations
		.map((rec) => {
			const rankPrefix =
				rec.rank <= 3 ? rankEmojis[rec.rank - 1] : `**${rec.rank}.**`;
			const emoji = rec.target.emoji ? `${rec.target.emoji} ` : "";
			return `${rankPrefix} ${emoji}**${rec.target.name}** — ${rec.percentage}%`;
		})
		.join("\n");

	embed.setDescription(
		description || "No recommendations found. Try answering more questions!",
	);

	// Add pros/cons fields for each result
	for (const rec of result.recommendations.slice(0, 5)) {
		const pros = rec.target.pros
			.slice(0, 3)
			.map((p) => `✅ ${p}`)
			.join("\n");
		const cons = rec.target.cons
			.slice(0, 2)
			.map((c) => `⚠️ ${c}`)
			.join("\n");

		let value = "";
		if (rec.target.kind === "stack" && rec.target.components) {
			value += `📦 *${rec.target.components.join(", ")}*\n`;
		}
		value += `${pros}\n${cons}`;

		embed.addFields({
			name: `${rec.target.emoji ?? ""} ${rec.target.name} (${rec.percentage}%)`,
			value,
			inline: false,
		});
	}

	if (result.fastTracked) {
		embed.setFooter({ text: "⚡ Fast-tracked recommendation" });
	} else {
		embed.setFooter({
			text: `Based on ${result.answeredQuestions} of ${result.totalQuestions} questions`,
		});
	}

	const components = buildResultComponents(result, sessionKey);

	return { embeds: [embed], components };
}

function buildResultComponents(
	result: QuizResult,
	sessionKey: string,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
	const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

	// Row 1: Resource link buttons (max 5 per row)
	const linkButtons = buildResourceLinkButtons(result);
	if (linkButtons.length > 0) {
		// Chunk into rows of 5
		for (let i = 0; i < linkButtons.length; i += 5) {
			const row = new ActionRowBuilder<ButtonBuilder>();
			row.addComponents(linkButtons.slice(i, i + 5));
			rows.push(row);
		}
	}

	// Check if any results have learning resource IDs
	const hasLearningResources = result.recommendations.some(
		(rec) =>
			rec.target.learningResourceIds &&
			rec.target.learningResourceIds.length > 0,
	);

	// Action buttons row
	const actionRow = new ActionRowBuilder<ButtonBuilder>();

	if (hasLearningResources) {
		actionRow.addComponents(
			new ButtonBuilder()
				.setCustomId(makeId(sessionKey, "resources"))
				.setLabel("Learning Resources")
				.setEmoji("📚")
				.setStyle(ButtonStyle.Success),
		);
	}

	actionRow.addComponents(
		new ButtonBuilder()
			.setCustomId(makeId(sessionKey, "share"))
			.setLabel("Share Results")
			.setEmoji("📢")
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(makeId(sessionKey, "restart"))
			.setLabel("Start Over")
			.setEmoji("🔄")
			.setStyle(ButtonStyle.Danger),
	);

	rows.push(actionRow);

	// Discord limits to 5 action rows total
	return rows.slice(0, 5);
}

function buildResourceLinkButtons(result: QuizResult): ButtonBuilder[] {
	const buttons: ButtonBuilder[] = [];

	for (const rec of result.recommendations.slice(0, 5)) {
		if (!rec.target.resources) continue;

		for (const resource of rec.target.resources.slice(0, 2)) {
			// Discord limits link buttons; keep it concise
			buttons.push(
				new ButtonBuilder()
					.setLabel(`${rec.target.name}: ${resource.label}`)
					.setURL(resource.url)
					.setStyle(ButtonStyle.Link),
			);
		}
	}

	// Discord allows max 25 components across 5 rows, but link buttons are generous
	return buttons.slice(0, 10);
}

// ─── Share embed (non-ephemeral, condensed) ──────────────────────────────────

export function renderShareEmbed(result: QuizResult, user: User): EmbedBuilder {
	const embed = createStandardEmbed()
		.setTitle(`${user.displayName}'s Language Recommendations`)
		.setThumbnail(user.displayAvatarURL());

	const description = result.recommendations
		.map((rec) => {
			const rankPrefix =
				rec.rank <= 3 ? rankEmojis[rec.rank - 1] : `**${rec.rank}.**`;
			const emoji = rec.target.emoji ? `${rec.target.emoji} ` : "";
			return `${rankPrefix} ${emoji}**${rec.target.name}** — ${rec.percentage}%\n> *${rec.target.description}*`;
		})
		.join("\n\n");

	embed.setDescription(description || "No recommendations.");
	embed.setFooter({ text: "Try /whatlang to get your own recommendations!" });

	return embed;
}

// ─── Learning resources select menu ──────────────────────────────────────────

export function renderLearningResourcesSelect(
	result: QuizResult,
	sessionKey: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
	const menu = new StringSelectMenuBuilder()
		.setCustomId(makeId(sessionKey, "learn-pick"))
		.setPlaceholder("Pick a language to see learning resources...");

	const options: StringSelectMenuOptionBuilder[] = [];

	for (const rec of result.recommendations) {
		if (
			!rec.target.learningResourceIds ||
			rec.target.learningResourceIds.length === 0
		)
			continue;

		for (const resourceId of rec.target.learningResourceIds) {
			options.push(
				new StringSelectMenuOptionBuilder()
					.setLabel(`${rec.target.name} Resources`)
					.setValue(resourceId)
					.setDescription(`Learning resources for ${rec.target.name}`),
			);
		}
	}

	menu.setOptions(options.slice(0, 25)); // Discord max 25 options

	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}
