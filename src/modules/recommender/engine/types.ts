// ─── Recommendation Targets ──────────────────────────────────────────────────

export type TargetKind = "language" | "stack";

export interface ResourceLink {
	label: string;
	url: string;
}

export interface RecommendationTarget {
	id: string;
	kind: TargetKind;
	name: string;
	emoji?: string;
	description: string;
	pros: string[];
	cons: string[];
	tags: string[];
	resources?: ResourceLink[];
	learningResourceIds?: string[];
	/** For stacks: the component technologies */
	components?: string[];
}

// ─── Questions ───────────────────────────────────────────────────────────────

export type QuestionType = "single" | "multi" | "scale";

export interface QuestionOption {
	id: string;
	label: string;
	emoji?: string;
	description?: string;
	/** target.id → score delta */
	weights: Record<string, number>;
	/** If set, immediately ends the quiz and recommends these target IDs */
	fastTrack?: string[];
}

export interface QuestionCondition {
	questionId: string;
	/** Show only if the user picked one of these answer IDs */
	answerId: string | string[];
	negate?: boolean;
}

export interface Question {
	id: string;
	text: string;
	type: QuestionType;
	options: QuestionOption[];
	/** For 'scale' type: min and max of the scale, e.g. [1, 5] */
	scaleRange?: [number, number];
	/** Labels for the scale endpoints, e.g. ["Easy & quick", "Powerful & safe"] */
	scaleLabels?: [string, string];
	/** For 'scale' type: target.id → [weight@min, weight@max] (linearly interpolated) */
	scaleWeights?: Record<string, [number, number]>;
	skippable: boolean;
	condition?: QuestionCondition;
	/** Ordering group — lower phases are asked first */
	phase: number;
}

// ─── Quiz Session State ──────────────────────────────────────────────────────

export interface QuizAnswer {
	questionId: string;
	/** For single: 1 element. For multi: N elements. For scale: ["3"] */
	selectedOptionIds: string[];
}

export interface QuizSession {
	answers: QuizAnswer[];
	/** target.id → accumulated score */
	scores: Record<string, number>;
	currentQuestionIndex: number;
	fastTracked: boolean;
	fastTrackTargetIds?: string[];
	completed: boolean;
}

// ─── Results ─────────────────────────────────────────────────────────────────

export interface RecommendationResult {
	target: RecommendationTarget;
	score: number;
	percentage: number;
	rank: number;
}

export interface QuizResult {
	recommendations: RecommendationResult[];
	fastTracked: boolean;
	answeredQuestions: number;
	totalQuestions: number;
}
