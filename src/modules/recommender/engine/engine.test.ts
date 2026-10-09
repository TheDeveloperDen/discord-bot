import { describe, expect, test } from "bun:test";
import { languages } from "./data/languages.js";
import { questions } from "./data/questions.js";
import { stacks } from "./data/stacks.js";
import {
	applyAnswer,
	computeResults,
	createQuizSession,
	getApplicableQuestionCount,
	getNextQuestion,
	isFastTracked,
	skipQuestion,
} from "./quiz.js";
import {
	applyDiversityBias,
	applyWeights,
	evaluateCondition,
} from "./scoring.js";
import type { QuizAnswer, QuizSession } from "./types.js";

describe("engine types and data", () => {
	test("all languages have required fields", () => {
		for (const lang of languages) {
			expect(lang.id).toBeTruthy();
			expect(lang.kind).toBe("language");
			expect(lang.name).toBeTruthy();
			expect(lang.description).toBeTruthy();
			expect(lang.pros.length).toBeGreaterThan(0);
			expect(lang.cons.length).toBeGreaterThan(0);
			expect(lang.tags.length).toBeGreaterThan(0);
		}
	});

	test("all stacks have required fields", () => {
		for (const stack of stacks) {
			expect(stack.id).toBeTruthy();
			expect(stack.kind).toBe("stack");
			expect(stack.name).toBeTruthy();
			expect(stack.components).toBeTruthy();
			expect(stack.components!.length).toBeGreaterThan(0);
		}
	});

	test("all question weight target IDs reference valid targets", () => {
		const targetIds = new Set([
			...languages.map((l) => l.id),
			...stacks.map((s) => s.id),
		]);

		for (const question of questions) {
			for (const option of question.options) {
				for (const targetId of Object.keys(option.weights)) {
					expect(targetIds.has(targetId)).toBe(true);
				}
			}
			if (question.scaleWeights) {
				for (const targetId of Object.keys(question.scaleWeights)) {
					expect(targetIds.has(targetId)).toBe(true);
				}
			}
		}
	});

	test("language IDs are unique", () => {
		const ids = languages.map((l) => l.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test("stack IDs are unique", () => {
		const ids = stacks.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe("quiz state machine", () => {
	test("createQuizSession returns a fresh session", () => {
		const session = createQuizSession();
		expect(session.answers).toEqual([]);
		expect(session.scores).toEqual({});
		expect(session.currentQuestionIndex).toBe(0);
		expect(session.fastTracked).toBe(false);
		expect(session.completed).toBe(false);
	});

	test("first question is the fast-track detector (phase 0)", () => {
		const session = createQuizSession();
		const question = getNextQuestion(session);
		expect(question).not.toBeNull();
		expect(question!.id).toBe("specific_goal");
		expect(question!.skippable).toBe(false);
	});

	test("questions are presented in non-decreasing phase order via the engine", () => {
		let session = createQuizSession();
		const phases: number[] = [];

		while (true) {
			const question = getNextQuestion(session);
			if (!question) break;

			phases.push(question.phase);

			if (question.id === "specific_goal") {
				session = applyAnswer(session, {
					questionId: question.id,
					selectedOptionIds: ["none"],
				});
				continue;
			}

			if (question.type === "scale") {
				session = applyAnswer(session, {
					questionId: question.id,
					selectedOptionIds: ["3"],
				});
				continue;
			}

			session = applyAnswer(session, {
				questionId: question.id,
				selectedOptionIds: [question.options[0]!.id],
			});
		}

		for (let i = 1; i < phases.length; i++) {
			expect(phases[i]).toBeGreaterThanOrEqual(phases[i - 1]!);
		}
	});

	test("answering 'none' to fast-track leads to main_goal", () => {
		let session = createQuizSession();
		session = applyAnswer(session, {
			questionId: "specific_goal",
			selectedOptionIds: ["none"],
		});
		const next = getNextQuestion(session);
		expect(next).not.toBeNull();
		expect(next!.id).toBe("main_goal");
	});

	test("normal flow completes after all applicable questions", () => {
		let session = createQuizSession();

		// Answer fast-track with "none"
		session = applyAnswer(session, {
			questionId: "specific_goal",
			selectedOptionIds: ["none"],
		});

		// Answer main goal
		session = applyAnswer(session, {
			questionId: "main_goal",
			selectedOptionIds: ["hobby"],
		});

		// Answer what to build
		session = applyAnswer(session, {
			questionId: "what_to_build",
			selectedOptionIds: ["games"],
		});

		// Answer performance scale
		session = applyAnswer(session, {
			questionId: "performance",
			selectedOptionIds: ["3"],
		});

		// Answer complexity scale
		session = applyAnswer(session, {
			questionId: "complexity",
			selectedOptionIds: ["3"],
		});

		// Answer job market (should appear since goal is "hobby", not "get_job")
		session = applyAnswer(session, {
			questionId: "job_market",
			selectedOptionIds: ["not_really"],
		});

		// Answer community
		session = applyAnswer(session, {
			questionId: "community",
			selectedOptionIds: ["dont_care"],
		});

		expect(session.completed).toBe(true);
		expect(getNextQuestion(session)).toBeNull();
	});

	test("non-skippable questions cannot be skipped", () => {
		let session = createQuizSession();

		session = skipQuestion(session, "specific_goal");

		expect(session.answers).toEqual([]);
		expect(session.completed).toBe(false);
		expect(getNextQuestion(session)?.id).toBe("specific_goal");
	});
});

describe("fast-track", () => {
	test("selecting minecraft plugins fast-tracks to java/kotlin", () => {
		let session = createQuizSession();
		session = applyAnswer(session, {
			questionId: "specific_goal",
			selectedOptionIds: ["minecraft_plugins"],
		});

		expect(isFastTracked(session)).toBe(true);
		expect(session.completed).toBe(true);
		expect(session.fastTrackTargetIds).toContain("java");
		expect(session.fastTrackTargetIds).toContain("kotlin");
	});

	test("fast-tracked results have high percentages", () => {
		let session = createQuizSession();
		session = applyAnswer(session, {
			questionId: "specific_goal",
			selectedOptionIds: ["discord_bots"],
		});

		const results = computeResults(session);
		expect(results.fastTracked).toBe(true);
		expect(results.recommendations.length).toBeGreaterThan(0);
		expect(results.recommendations[0].percentage).toBe(100);
	});
});

describe("scoring", () => {
	test("applyWeights adds option weights for single-choice", () => {
		const answer: QuizAnswer = {
			questionId: "main_goal",
			selectedOptionIds: ["get_job"],
		};
		const scores = applyWeights({}, answer);
		expect(scores.javascript).toBe(15);
		expect(scores.python).toBe(15);
		expect(scores.java).toBe(15);
	});

	test("applyWeights adds option weights for multi-choice", () => {
		const answer: QuizAnswer = {
			questionId: "what_to_build",
			selectedOptionIds: ["websites", "ai_ml"],
		};
		const scores = applyWeights({}, answer);
		// websites: javascript: 18, ai_ml: python: 22
		expect(scores.javascript).toBe(18);
		expect(scores.python).toBe(8 + 22); // websites.python + ai_ml.python
	});

	test("applyWeights interpolates scale weights", () => {
		// Performance at 1 (don't care)
		const answer1: QuizAnswer = {
			questionId: "performance",
			selectedOptionIds: ["1"],
		};
		const scores1 = applyWeights({}, answer1);
		expect(scores1.python).toBe(15); // [15, -10] at t=0 → 15
		expect(scores1.c).toBe(-5); // [-5, 25] at t=0 → -5

		// Performance at 5 (very important)
		const answer5: QuizAnswer = {
			questionId: "performance",
			selectedOptionIds: ["5"],
		};
		const scores5 = applyWeights({}, answer5);
		expect(scores5.python).toBe(-10); // [15, -10] at t=1 → -10
		expect(scores5.c).toBe(25); // [-5, 25] at t=1 → 25
	});

	test("applyWeights interpolates scale midpoint correctly", () => {
		const answer: QuizAnswer = {
			questionId: "performance",
			selectedOptionIds: ["3"],
		};
		const scores = applyWeights({}, answer);
		// python: lerp(15, -10, 0.5) = 2.5
		expect(scores.python).toBeCloseTo(2.5);
		// c: lerp(-5, 25, 0.5) = 10
		expect(scores.c).toBeCloseTo(10);
	});

	test("diversity bias penalizes mainstream for hobbyists", () => {
		const session: QuizSession = {
			answers: [{ questionId: "main_goal", selectedOptionIds: ["hobby"] }],
			scores: { python: 100, rust: 100 },
			currentQuestionIndex: 1,
			fastTracked: false,
			completed: false,
		};

		const biased = applyDiversityBias(session.scores, session);
		// Python has "mainstream" tag → 100 * 0.85 = 85
		expect(biased.python).toBeCloseTo(85);
		// Rust has "niche" tag → 100 * 1.1 = 110
		expect(biased.rust).toBeCloseTo(110);
	});

	test("diversity bias does NOT apply for non-hobby goals", () => {
		const session: QuizSession = {
			answers: [{ questionId: "main_goal", selectedOptionIds: ["get_job"] }],
			scores: { python: 100, rust: 100 },
			currentQuestionIndex: 1,
			fastTracked: false,
			completed: false,
		};

		const biased = applyDiversityBias(session.scores, session);
		expect(biased.python).toBe(100);
		expect(biased.rust).toBe(100);
	});
});

describe("condition evaluation", () => {
	test("question with no condition always shows", () => {
		const result = evaluateCondition({ condition: undefined }, { answers: [] });
		expect(result).toBe(true);
	});

	test("condition matches when answer is present", () => {
		const result = evaluateCondition(
			{ condition: { questionId: "specific_goal", answerId: "none" } },
			{
				answers: [{ questionId: "specific_goal", selectedOptionIds: ["none"] }],
			},
		);
		expect(result).toBe(true);
	});

	test("condition fails when answer doesn't match", () => {
		const result = evaluateCondition(
			{ condition: { questionId: "specific_goal", answerId: "none" } },
			{
				answers: [
					{
						questionId: "specific_goal",
						selectedOptionIds: ["minecraft_plugins"],
					},
				],
			},
		);
		expect(result).toBe(false);
	});

	test("negated condition inverts the result", () => {
		const result = evaluateCondition(
			{
				condition: {
					questionId: "main_goal",
					answerId: "get_job",
					negate: true,
				},
			},
			{ answers: [{ questionId: "main_goal", selectedOptionIds: ["hobby"] }] },
		);
		expect(result).toBe(true);
	});

	test("condition with array of acceptable answers", () => {
		const result = evaluateCondition(
			{
				condition: {
					questionId: "main_goal",
					answerId: ["hobby", "build_easy"],
				},
			},
			{ answers: [{ questionId: "main_goal", selectedOptionIds: ["hobby"] }] },
		);
		expect(result).toBe(true);
	});

	test("job_market question is hidden when goal is get_job", () => {
		const jobMarketQ = questions.find((q) => q.id === "job_market");
		expect(jobMarketQ).toBeTruthy();

		const result = evaluateCondition(jobMarketQ!, {
			answers: [
				{ questionId: "specific_goal", selectedOptionIds: ["none"] },
				{ questionId: "main_goal", selectedOptionIds: ["get_job"] },
			],
		});
		expect(result).toBe(false);
	});
});

describe("computeResults", () => {
	test("returns ranked results sorted by score", () => {
		let session = createQuizSession();
		session = applyAnswer(session, {
			questionId: "specific_goal",
			selectedOptionIds: ["none"],
		});
		session = applyAnswer(session, {
			questionId: "main_goal",
			selectedOptionIds: ["get_job"],
		});
		session = { ...session, completed: true };

		const results = computeResults(session);
		expect(results.recommendations.length).toBeGreaterThan(0);

		// Check sorted descending
		for (let i = 1; i < results.recommendations.length; i++) {
			expect(results.recommendations[i - 1].score).toBeGreaterThanOrEqual(
				results.recommendations[i].score,
			);
		}
	});

	test("top result always has 100%", () => {
		let session = createQuizSession();
		session = applyAnswer(session, {
			questionId: "specific_goal",
			selectedOptionIds: ["none"],
		});
		session = applyAnswer(session, {
			questionId: "main_goal",
			selectedOptionIds: ["learn_computers"],
		});
		session = { ...session, completed: true };

		const results = computeResults(session);
		expect(results.recommendations[0].percentage).toBe(100);
	});

	test("excludes targets with non-positive scores", () => {
		let session = createQuizSession();
		session = applyAnswer(session, {
			questionId: "specific_goal",
			selectedOptionIds: ["none"],
		});
		session = applyAnswer(session, {
			questionId: "main_goal",
			selectedOptionIds: ["learn_computers"],
		});
		session = { ...session, completed: true };

		const results = computeResults(session);
		for (const rec of results.recommendations) {
			expect(rec.score).toBeGreaterThan(0);
		}
	});

	test("respects topN limit", () => {
		let session = createQuizSession();
		session = applyAnswer(session, {
			questionId: "specific_goal",
			selectedOptionIds: ["none"],
		});
		session = applyAnswer(session, {
			questionId: "main_goal",
			selectedOptionIds: ["get_job"],
		});
		session = { ...session, completed: true };

		const results = computeResults(session, 3);
		expect(results.recommendations.length).toBeLessThanOrEqual(3);
	});

	test("hobbyist + games gives diverse results (not just mainstream)", () => {
		let session = createQuizSession();
		session = applyAnswer(session, {
			questionId: "specific_goal",
			selectedOptionIds: ["none"],
		});
		session = applyAnswer(session, {
			questionId: "main_goal",
			selectedOptionIds: ["hobby"],
		});
		session = applyAnswer(session, {
			questionId: "what_to_build",
			selectedOptionIds: ["games"],
		});
		session = { ...session, completed: true };

		const results = computeResults(session, 5);
		const names = results.recommendations.map((r) => r.target.id);

		// Game-dev stack should be highly ranked
		expect(names).toContain("game-dev-stack");
		// Should have at least one niche language in top 5
		const hasNiche = results.recommendations.some((r) =>
			r.target.tags.includes("niche"),
		);
		expect(hasNiche).toBe(true);
	});
});
