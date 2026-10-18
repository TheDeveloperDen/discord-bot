import { describe, expect, test } from "bun:test";
import { ComponentType, MessageFlags } from "discord.js";
import {
	createRegexPuzzleSession,
	RegexAnswerModal,
	RegexHintButton,
	RegexNewPuzzleButton,
	RegexRevealButton,
} from "./regex.command.js";

const answerFieldId = "regex-answer";

type Reply = { flags?: MessageFlags; components?: unknown[] };
type ResponseOptions = {
	editGate?: Promise<void>;
	onEditStart?: () => void;
};

function responses({ editGate, onEditStart }: ResponseOptions = {}) {
	const replies: Reply[] = [];
	const updates: Reply[] = [];
	return {
		replies,
		updates,
		interaction: (userId: string) => ({
			user: { id: userId },
			reply: async (response: Reply) => {
				replies.push(response);
			},
			deferUpdate: async () => {},
			editReply: async (response: Reply) => {
				updates.push(response);
				onEditStart?.();
				if (editGate) await editGate;
			},
		}),
	};
}

function modalInteraction(
	userId: string,
	answer: string,
	fromMessage = true,
	options?: ResponseOptions,
) {
	const result = responses(options);
	const fields = new Map<string, { type: ComponentType; value: string }>();
	fields.set(answerFieldId, { type: ComponentType.TextInput, value: answer });
	return {
		...result,
		interaction: {
			...result.interaction(userId),
			isFromMessage: () => fromMessage,
			fields: { fields },
		},
	};
}

function componentIds(payload: Reply) {
	const ids: string[] = [];
	const visit = (components: unknown[]) => {
		for (const component of components) {
			if (!component || typeof component !== "object") continue;
			const candidate = component as {
				custom_id?: string;
				components?: unknown[];
			};
			if (candidate.custom_id) ids.push(candidate.custom_id);
			if (candidate.components) visit(candidate.components);
		}
	};
	visit(payload.components ?? []);
	return ids;
}

describe("/regex challenge interactions", () => {
	test("prevents other players from changing an active puzzle", async () => {
		const session = createRegexPuzzleSession("owner", "easy");
		const hint = responses();
		const reveal = responses();
		const answer = modalInteraction(
			"another-player",
			session.challenge.example,
		);

		await RegexHintButton.handle(hint.interaction("another-player") as never, {
			puzzleId: session.id,
		});
		await RegexRevealButton.handle(
			reveal.interaction("another-player") as never,
			{
				puzzleId: session.id,
			},
		);
		await RegexAnswerModal.handle(answer.interaction as never, {
			puzzleId: session.id,
		});

		expect(session.state).toBe("active");
		expect(session.attempts).toBe(0);
		expect(hint.updates).toHaveLength(0);
		expect(reveal.updates).toHaveLength(0);
		expect(answer.updates).toHaveLength(0);
		expect(hint.replies[0]?.flags).toBe(MessageFlags.Ephemeral);
		expect(reveal.replies[0]?.flags).toBe(MessageFlags.Ephemeral);
		expect(answer.replies[0]?.flags).toBe(MessageFlags.Ephemeral);
	});

	test("keeps an incorrect answer retryable and settles a later correct answer", async () => {
		const session = createRegexPuzzleSession("owner", "easy");
		const incorrect = modalInteraction("owner", "\0");
		await RegexAnswerModal.handle(incorrect.interaction as never, {
			puzzleId: session.id,
		});
		expect(session.state).toBe("active");
		expect(session.attempts).toBe(1);
		expect(incorrect.updates).toHaveLength(1);

		const correct = modalInteraction("owner", session.challenge.example);
		await RegexAnswerModal.handle(correct.interaction as never, {
			puzzleId: session.id,
		});
		expect(session.state).toBe("succeeded");
		expect(session.attempts).toBe(2);
		expect(correct.updates).toHaveLength(1);

		const replay = modalInteraction("owner", session.challenge.example);
		await RegexAnswerModal.handle(replay.interaction as never, {
			puzzleId: session.id,
		});
		expect(session.state).toBe("succeeded");
		expect(session.attempts).toBe(2);
		expect(replay.updates).toHaveLength(0);
		expect(replay.replies[0]?.flags).toBe(MessageFlags.Ephemeral);
	});

	test("rejects an answer form without its source message", async () => {
		const session = createRegexPuzzleSession("owner", "easy");
		const answer = modalInteraction("owner", session.challenge.example, false);
		await RegexAnswerModal.handle(answer.interaction as never, {
			puzzleId: session.id,
		});
		expect(session.state).toBe("active");
		expect(session.attempts).toBe(0);
		expect(answer.updates).toHaveLength(0);
		expect(answer.replies[0]?.flags).toBe(MessageFlags.Ephemeral);
	});

	test("settles concurrent modal answers only once", async () => {
		const session = createRegexPuzzleSession("owner", "easy");
		const first = modalInteraction("owner", session.challenge.example);
		const second = modalInteraction("owner", session.challenge.example);
		await Promise.all([
			RegexAnswerModal.handle(first.interaction as never, {
				puzzleId: session.id,
			}),
			RegexAnswerModal.handle(second.interaction as never, {
				puzzleId: session.id,
			}),
		]);
		expect(session.state).toBe("succeeded");
		expect(session.attempts).toBe(1);
		expect(first.updates.length + second.updates.length).toBe(1);
		expect(first.replies.length + second.replies.length).toBe(1);
		expect(first.replies[0]?.flags ?? second.replies[0]?.flags).toBe(
			MessageFlags.Ephemeral,
		);
	});

	test("keeps a queued retry from restoring active controls after success", async () => {
		const session = createRegexPuzzleSession("owner", "easy");
		const firstEdit = Promise.withResolvers<void>();
		const releaseFirstEdit = Promise.withResolvers<void>();
		const wrong = modalInteraction("owner", "\0", true, {
			editGate: releaseFirstEdit.promise,
			onEditStart: firstEdit.resolve,
		});
		const wrongTask = RegexAnswerModal.handle(wrong.interaction as never, {
			puzzleId: session.id,
		});
		await firstEdit.promise;

		const correct = modalInteraction("owner", session.challenge.example);
		const correctTask = RegexAnswerModal.handle(correct.interaction as never, {
			puzzleId: session.id,
		});
		releaseFirstEdit.resolve();
		await Promise.all([wrongTask, correctTask]);

		const writes = [...wrong.updates, ...correct.updates];
		const finalControls = componentIds(writes[writes.length - 1] ?? {});
		expect(session.state).toBe("succeeded");
		expect(session.attempts).toBe(2);
		expect(writes).toHaveLength(2);
		expect(finalControls).toHaveLength(1);
		expect(finalControls[0]).toStartWith("regex:new:");
	});

	test("rejects expired and terminal submissions and invalidates old New buttons", async () => {
		const expiredSession = createRegexPuzzleSession("owner", "easy");
		expiredSession.expiresAt = Date.now() - 1;
		const expired = modalInteraction("owner", "anything");
		await RegexAnswerModal.handle(expired.interaction as never, {
			puzzleId: expiredSession.id,
		});
		expect(expiredSession.state).toBe("active");
		expect(expiredSession.attempts).toBe(0);
		expect(expired.updates).toHaveLength(0);
		expect(expired.replies[0]?.flags).toBe(MessageFlags.Ephemeral);

		const session = createRegexPuzzleSession("owner", "medium");
		const reveal = responses();
		await RegexRevealButton.handle(reveal.interaction("owner") as never, {
			puzzleId: session.id,
		});
		expect(session.state).toBe("revealed");
		expect(reveal.updates).toHaveLength(1);

		const terminal = modalInteraction("owner", session.challenge.example);
		await RegexAnswerModal.handle(terminal.interaction as never, {
			puzzleId: session.id,
		});
		expect(session.state).toBe("revealed");
		expect(session.attempts).toBe(0);
		expect(terminal.updates).toHaveLength(0);
		expect(terminal.replies[0]?.flags).toBe(MessageFlags.Ephemeral);

		const replacement = responses();
		await RegexNewPuzzleButton.handle(
			replacement.interaction("owner") as never,
			{
				puzzleId: session.id,
			},
		);
		expect(replacement.updates).toHaveLength(1);

		const replayNew = responses();
		await RegexNewPuzzleButton.handle(replayNew.interaction("owner") as never, {
			puzzleId: session.id,
		});
		expect(replayNew.updates).toHaveLength(0);
		expect(replayNew.replies[0]?.flags).toBe(MessageFlags.Ephemeral);
	});
});
