import { randomUUID } from "node:crypto";
import {
	type ButtonInteraction,
	ButtonStyle,
	ComponentType,
	MessageFlags,
	type RepliableInteraction,
	TextInputStyle,
} from "discord.js";
import {
	ActionRow,
	Label,
	Message,
	renderDiscordMessage,
	renderDiscordModal,
	TextInput,
} from "disjsx";
import ExpiryMap from "expiry-map";
import { defineCommand, option } from "../../commands/index.js";
import { defineComponent } from "../../components/index.js";
import { Card, withoutPings } from "../../ui/index.js";
import {
	createRegexChallenge,
	isRegexChallengeMatch,
	MAX_REGEX_ANSWER_LENGTH,
	type RegexChallenge,
	type RegexDifficulty,
} from "./regexChallenge.js";

const REGEX_PUZZLE_TTL_MS = 10 * 60 * 1000;
const ANSWER_INPUT_ID = "regex-answer";

type PuzzleState = "active" | "succeeded" | "revealed";
type PuzzleAccessFailure = "active" | "notOwner" | "stale" | "terminal";

type PuzzleInteraction = Pick<RepliableInteraction, "reply" | "user">;
type ReplyInteraction = Pick<RepliableInteraction, "reply">;

type PuzzleUpdateInteraction = Pick<
	ButtonInteraction,
	"deferUpdate" | "editReply"
>;

const accessFailureMessage = {
	active: "Finish or reveal this puzzle before starting a new one.",
	notOwner:
		"This puzzle belongs to another player. Run /regex to start your own.",
	stale:
		"This puzzle has expired or the bot restarted. Run /regex again to start a new one.",
	terminal:
		"This puzzle has already ended. Run /regex again to start a new one.",
} satisfies Record<PuzzleAccessFailure, string>;

export interface RegexPuzzleSession {
	id: string;
	ownerId: string;
	challenge: RegexChallenge;
	attempts: number;
	state: PuzzleState;
	expiresAt: number;
	pendingUpdate: Promise<void>;
}

const puzzles = new ExpiryMap<string, RegexPuzzleSession>(REGEX_PUZZLE_TTL_MS);

/** Creates an owner-bound challenge session with the standard ten-minute lifetime. */
export function createRegexPuzzleSession(
	ownerId: string,
	difficulty: RegexDifficulty,
): RegexPuzzleSession {
	const session: RegexPuzzleSession = {
		id: randomUUID(),
		ownerId,
		challenge: createRegexChallenge(difficulty),
		attempts: 0,
		state: "active",
		expiresAt: Date.now() + REGEX_PUZZLE_TTL_MS,
		pendingUpdate: Promise.resolve(),
	};
	puzzles.set(session.id, session);
	return session;
}

const inlineCode = (value: string) => `\`${value.replaceAll("`", "\\`")}\``;

function renderPuzzle(
	session: RegexPuzzleSession,
	notice?: string,
	ephemeral = false,
) {
	const { challenge } = session;
	const sensitivity = challenge.flags.includes("i")
		? "This expression ignores letter case."
		: "This expression is case-sensitive.";
	return withoutPings(
		renderDiscordMessage(
			<Message isV2 flags={ephemeral ? MessageFlags.Ephemeral : undefined}>
				<Card
					title="Regex challenge"
					description={[
						notice
							? `**${notice}**`
							: "Find any text that satisfies this JavaScript regular expression.",
						[
							`Difficulty: **${challenge.difficulty}**`,
							`Expression: ${inlineCode(`/${challenge.source}/${challenge.flags}`)}`,
							"Your answer must match the entire input; spaces and punctuation count.",
							sensitivity,
							`Attempts: **${session.attempts}**`,
						].join("\n"),
					]}
				/>
				<ActionRow>
					<RegexSubmitButton puzzleId={session.id} style={ButtonStyle.Primary}>
						Submit answer
					</RegexSubmitButton>
					<RegexHintButton puzzleId={session.id} style={ButtonStyle.Secondary}>
						Hint
					</RegexHintButton>
					<RegexRevealButton puzzleId={session.id} style={ButtonStyle.Danger}>
						Reveal solution
					</RegexRevealButton>
				</ActionRow>
			</Message>,
		),
	);
}

function renderTerminalPuzzle(session: RegexPuzzleSession) {
	const { challenge } = session;
	const succeeded = session.state === "succeeded";
	const context = [
		`Difficulty: **${challenge.difficulty}**`,
		`Expression: ${inlineCode(`/${challenge.source}/${challenge.flags}`)}`,
	];
	const result = succeeded
		? [
				"**Correct — that is a full match.**",
				`Solved in **${session.attempts}** ${session.attempts === 1 ? "attempt" : "attempts"}.`,
				...context,
				challenge.explanation,
			]
		: [
				"**Solution revealed.**",
				`One valid example is ${inlineCode(JSON.stringify(challenge.example))}.`,
				...context,
				challenge.explanation,
			];
	return withoutPings(
		renderDiscordMessage(
			<Message isV2>
				<Card
					title="Regex challenge complete"
					description={result.join("\n\n")}
				/>
				<ActionRow>
					<RegexNewPuzzleButton
						puzzleId={session.id}
						style={ButtonStyle.Success}
					>
						New puzzle
					</RegexNewPuzzleButton>
				</ActionRow>
			</Message>,
		),
	);
}

async function replyAccessFailure(
	interaction: ReplyInteraction,
	failure: PuzzleAccessFailure,
) {
	await interaction.reply({
		flags: MessageFlags.Ephemeral,
		content: accessFailureMessage[failure],
	});
}

function getOwnedPuzzle(
	interaction: PuzzleInteraction,
	puzzleId: string,
	expectedState: "active" | "terminal",
): RegexPuzzleSession | PuzzleAccessFailure {
	const session = puzzles.get(puzzleId);
	if (!session || session.expiresAt <= Date.now()) {
		puzzles.delete(puzzleId);
		return "stale";
	}
	if (session.ownerId !== interaction.user.id) return "notOwner";
	if (expectedState === "active" && session.state !== "active")
		return "terminal";
	if (expectedState === "terminal" && session.state === "active")
		return "active";
	return session;
}

function renderCurrentPuzzle(session: RegexPuzzleSession, notice?: string) {
	return session.state === "active"
		? renderPuzzle(session, notice)
		: renderTerminalPuzzle(session);
}

function queuePuzzleUpdate(
	interaction: PuzzleUpdateInteraction,
	session: RegexPuzzleSession,
	notice?: string,
) {
	let acknowledgementError: unknown;
	const acknowledged = interaction.deferUpdate().then(
		() => true,
		(error) => {
			acknowledgementError = error;
			return false;
		},
	);
	const write = session.pendingUpdate.then(async () => {
		if (!(await acknowledged)) throw acknowledgementError;
		await interaction.editReply(renderCurrentPuzzle(session, notice));
	});
	session.pendingUpdate = write.catch(() => undefined);
	return write;
}

export const RegexSubmitButton = defineComponent({
	id: "regex:submit",
	kind: "button",
	args: ["puzzleId"],
	async handle(interaction, { puzzleId }) {
		const session = getOwnedPuzzle(interaction, puzzleId, "active");
		if (typeof session === "string") {
			await replyAccessFailure(interaction, session);
			return;
		}
		await interaction.showModal(
			renderDiscordModal(
				<RegexAnswerModal
					puzzleId={session.id}
					title="Submit your full-match answer"
				>
					<Label label="Answer">
						<TextInput
							customId={ANSWER_INPUT_ID}
							style={TextInputStyle.Short}
							required
							maxLength={MAX_REGEX_ANSWER_LENGTH}
						/>
					</Label>
				</RegexAnswerModal>,
			),
		);
	},
});

export const RegexHintButton = defineComponent({
	id: "regex:hint",
	kind: "button",
	args: ["puzzleId"],
	async handle(interaction, { puzzleId }) {
		const session = getOwnedPuzzle(interaction, puzzleId, "active");
		if (typeof session === "string") {
			await replyAccessFailure(interaction, session);
			return;
		}
		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: `Hint: ${session.challenge.hint}`,
		});
	},
});

export const RegexRevealButton = defineComponent({
	id: "regex:reveal",
	kind: "button",
	args: ["puzzleId"],
	async handle(interaction, { puzzleId }) {
		const session = getOwnedPuzzle(interaction, puzzleId, "active");
		if (typeof session === "string") {
			await replyAccessFailure(interaction, session);
			return;
		}
		session.state = "revealed";
		await queuePuzzleUpdate(interaction, session);
	},
});

export const RegexAnswerModal = defineComponent({
	id: "regex:answer",
	kind: "modal",
	args: ["puzzleId"],
	async handle(interaction, { puzzleId }) {
		const session = getOwnedPuzzle(interaction, puzzleId, "active");
		if (typeof session === "string") {
			await replyAccessFailure(interaction, session);
			return;
		}
		if (!interaction.isFromMessage()) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content:
					"This answer form is no longer attached to its puzzle. Run /regex again to start a new one.",
			});
			return;
		}
		const field = interaction.fields.fields.get(ANSWER_INPUT_ID);
		if (field?.type !== ComponentType.TextInput) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content:
					"Your answer could not be read. Run /regex again to start a new puzzle.",
			});
			return;
		}
		const answer = field.value;
		if (answer.length > MAX_REGEX_ANSWER_LENGTH) {
			await interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: `Answers must be ${MAX_REGEX_ANSWER_LENGTH} characters or fewer.`,
			});
			return;
		}

		session.attempts += 1;
		if (!isRegexChallengeMatch(session.challenge, answer)) {
			await queuePuzzleUpdate(
				interaction,
				session,
				"Not a full match. Try again.",
			);
			return;
		}

		session.state = "succeeded";
		await queuePuzzleUpdate(interaction, session);
	},
});

export const RegexNewPuzzleButton = defineComponent({
	id: "regex:new",
	kind: "button",
	args: ["puzzleId"],
	async handle(interaction, { puzzleId }) {
		const session = getOwnedPuzzle(interaction, puzzleId, "terminal");
		if (typeof session === "string") {
			await replyAccessFailure(interaction, session);
			return;
		}
		puzzles.delete(session.id);
		const next = createRegexPuzzleSession(
			interaction.user.id,
			session.challenge.difficulty,
		);
		next.pendingUpdate = session.pendingUpdate;
		await queuePuzzleUpdate(interaction, next);
	},
});

export const RegexCommand = defineCommand({
	name: "regex",
	description: "Practice matching JavaScript regular expressions",
	options: {
		difficulty: option.string({
			description: "Choose a challenge difficulty",
			choices: [
				{ name: "Easy", value: "easy" },
				{ name: "Medium", value: "medium" },
				{ name: "Hard", value: "hard" },
			] as const,
		}),
	},
	async handle(interaction, { difficulty }) {
		const session = createRegexPuzzleSession(
			interaction.user.id,
			difficulty ?? "easy",
		);
		await interaction.reply(renderPuzzle(session, undefined, true));
	},
});

export const regexComponents = [
	RegexSubmitButton,
	RegexHintButton,
	RegexRevealButton,
	RegexAnswerModal,
	RegexNewPuzzleButton,
];
