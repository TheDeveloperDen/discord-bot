import { questions } from "./data/questions.js";
import {
	applyWeights,
	computeResults as computeResultsFromScoring,
	evaluateCondition,
} from "./scoring.js";
import type { Question, QuizAnswer, QuizResult, QuizSession } from "./types.js";

/** Create a fresh quiz session with all scores at zero. */
export function createQuizSession(): QuizSession {
	return {
		answers: [],
		scores: {},
		currentQuestionIndex: 0,
		fastTracked: false,
		completed: false,
	};
}

/** Get the sorted list of questions applicable to this session. */
function getSortedQuestions(): Question[] {
	return [...questions].sort((a, b) => a.phase - b.phase);
}

/**
 * Get the next question to ask, or null if the quiz is complete.
 * Evaluates conditions against prior answers to skip irrelevant questions.
 */
export function getNextQuestion(session: QuizSession): Question | null {
	if (session.completed || session.fastTracked) return null;

	const sorted = getSortedQuestions();
	const answeredIds = new Set(session.answers.map((a) => a.questionId));

	for (const question of sorted) {
		if (answeredIds.has(question.id)) continue;
		if (evaluateCondition(question, session)) {
			return question;
		}
	}

	return null;
}

/**
 * Apply an answer to the session. Returns a new session (immutable).
 * If the answer triggers a fast-track, marks the session as completed.
 */
export function applyAnswer(
	session: QuizSession,
	answer: QuizAnswer,
): QuizSession {
	const newScores = applyWeights(session.scores, answer);
	const newAnswers = [...session.answers, answer];

	// Check for fast-track
	const sorted = getSortedQuestions();
	const question = sorted.find((q) => q.id === answer.questionId);
	if (question) {
		for (const optionId of answer.selectedOptionIds) {
			const option = question.options.find((o) => o.id === optionId);
			if (option?.fastTrack && option.fastTrack.length > 0) {
				return {
					answers: newAnswers,
					scores: newScores,
					currentQuestionIndex: session.currentQuestionIndex + 1,
					fastTracked: true,
					fastTrackTargetIds: option.fastTrack,
					completed: true,
				};
			}
		}
	}

	const newSession: QuizSession = {
		answers: newAnswers,
		scores: newScores,
		currentQuestionIndex: session.currentQuestionIndex + 1,
		fastTracked: false,
		completed: false,
	};

	// Check if there are more questions
	if (getNextQuestion(newSession) === null) {
		return { ...newSession, completed: true };
	}

	return newSession;
}

/**
 * Skip the current question. Returns a new session (no score changes).
 */
export function skipQuestion(
	session: QuizSession,
	questionId: string,
): QuizSession {
	// Record the skip as an answer with no selections (for condition tracking)
	const skipAnswer: QuizAnswer = {
		questionId,
		selectedOptionIds: [],
	};

	const newSession: QuizSession = {
		...session,
		answers: [...session.answers, skipAnswer],
		currentQuestionIndex: session.currentQuestionIndex + 1,
	};

	if (getNextQuestion(newSession) === null) {
		return { ...newSession, completed: true };
	}

	return newSession;
}

/** Check if the session was fast-tracked by the latest answer. */
export function isFastTracked(session: QuizSession): boolean {
	return session.fastTracked;
}

/** Compute final results. Delegates to scoring module. */
export function computeResults(
	session: QuizSession,
	topN?: number,
): QuizResult {
	return computeResultsFromScoring(session, topN);
}

/** Get the total number of questions applicable to this session. */
export function getApplicableQuestionCount(session: QuizSession): number {
	const sorted = getSortedQuestions();
	return sorted.filter((q) => evaluateCondition(q, session)).length;
}
