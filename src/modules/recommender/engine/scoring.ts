import { languages } from "./data/languages.js";
import { questions } from "./data/questions.js";
import { stacks } from "./data/stacks.js";
import type {
	QuizAnswer,
	QuizResult,
	QuizSession,
	RecommendationResult,
	RecommendationTarget,
} from "./types.js";

const allTargets: RecommendationTarget[] = [...languages, ...stacks];

function getTargetById(id: string): RecommendationTarget | undefined {
	return allTargets.find((t) => t.id === id);
}

function getQuestionById(id: string) {
	return questions.find((q) => q.id === id);
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** Apply a single answer's weights to the score map. Returns a new scores object. */
export function applyWeights(
	scores: Record<string, number>,
	answer: QuizAnswer,
): Record<string, number> {
	const newScores = { ...scores };
	const question = getQuestionById(answer.questionId);
	if (!question) return newScores;

	if (
		question.type === "scale" &&
		question.scaleWeights &&
		question.scaleRange
	) {
		const value = Number.parseInt(answer.selectedOptionIds[0], 10);
		const [min, max] = question.scaleRange;
		const t = (value - min) / (max - min);

		for (const [targetId, [weightAtMin, weightAtMax]] of Object.entries(
			question.scaleWeights,
		)) {
			newScores[targetId] =
				(newScores[targetId] ?? 0) + lerp(weightAtMin, weightAtMax, t);
		}
	} else {
		for (const optionId of answer.selectedOptionIds) {
			const option = question.options.find((o) => o.id === optionId);
			if (!option) continue;

			for (const [targetId, weight] of Object.entries(option.weights)) {
				newScores[targetId] = (newScores[targetId] ?? 0) + weight;
			}
		}
	}

	return newScores;
}

/** Apply diversity bias for hobbyist users: penalize mainstream, boost niche. */
export function applyDiversityBias(
	scores: Record<string, number>,
	session: QuizSession,
): Record<string, number> {
	const goalAnswer = session.answers.find((a) => a.questionId === "main_goal");
	if (!goalAnswer || !goalAnswer.selectedOptionIds.includes("hobby")) {
		return scores;
	}

	const newScores = { ...scores };
	for (const target of allTargets) {
		if (newScores[target.id] === undefined) continue;

		if (target.tags.includes("mainstream")) {
			newScores[target.id] *= 0.85;
		}
		if (target.tags.includes("niche")) {
			newScores[target.id] *= 1.1;
		}
	}
	return newScores;
}

/** Compute final results from a completed session. */
export function computeResults(session: QuizSession, topN = 5): QuizResult {
	const totalQuestions = getApplicableQuestionCount(session);
	const answeredQuestions = session.answers.length;

	// Fast-track: return those targets at 100%
	if (session.fastTracked && session.fastTrackTargetIds) {
		const recommendations: RecommendationResult[] = session.fastTrackTargetIds
			.map((id, index) => {
				const target = getTargetById(id);
				if (!target) return null;
				return {
					target,
					score: 100 - index * 10,
					percentage: 100 - index * 10,
					rank: index + 1,
				};
			})
			.filter((r): r is RecommendationResult => r !== null);

		return {
			recommendations,
			fastTracked: true,
			answeredQuestions,
			totalQuestions,
		};
	}

	// Apply diversity bias
	const scores = applyDiversityBias({ ...session.scores }, session);

	// Filter out non-positive scores, sort descending
	const scored = Object.entries(scores)
		.filter(([, score]) => score > 0)
		.sort(([, a], [, b]) => b - a);

	if (scored.length === 0) {
		return {
			recommendations: [],
			fastTracked: false,
			answeredQuestions,
			totalQuestions,
		};
	}

	const maxScore = scored[0][1];

	const recommendations: RecommendationResult[] = scored
		.slice(0, topN)
		.map(([targetId, score], index) => {
			const target = getTargetById(targetId);
			if (!target) return null;
			return {
				target,
				score,
				percentage: Math.round((score / maxScore) * 100),
				rank: index + 1,
			};
		})
		.filter((r): r is RecommendationResult => r !== null);

	return {
		recommendations,
		fastTracked: false,
		answeredQuestions,
		totalQuestions,
	};
}

/** Count how many questions are applicable (conditions met) for this session. */
function getApplicableQuestionCount(session: QuizSession): number {
	let count = 0;
	for (const question of questions) {
		if (evaluateCondition(question, session)) {
			count++;
		}
	}
	return count;
}

/** Check if a question's condition is met given the current answers. */
export function evaluateCondition(
	question: {
		condition?: {
			questionId: string;
			answerId: string | string[];
			negate?: boolean;
		};
	},
	session: Pick<QuizSession, "answers">,
): boolean {
	if (!question.condition) return true;

	const { questionId, answerId, negate } = question.condition;
	const priorAnswer = session.answers.find((a) => a.questionId === questionId);

	const acceptedIds = Array.isArray(answerId) ? answerId : [answerId];

	// If the dependent question was never encountered at all, condition is not met
	if (!priorAnswer) {
		return false;
	}

	const matched = priorAnswer.selectedOptionIds.some((id) =>
		acceptedIds.includes(id),
	);
	return negate ? !matched : matched;
}
