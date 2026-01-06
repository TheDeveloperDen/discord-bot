import {
	type CreationOptional,
	DataTypes,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
	Op,
} from "@sequelize/core";
import {
	Attribute,
	AutoIncrement,
	Default,
	NotNull,
	PrimaryKey,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";

export enum ReputationEventType {
	// Positive events
	HELPED_USER = "HELPED_USER",
	QUALITY_CONTRIBUTION = "QUALITY_CONTRIBUTION",
	VALID_REPORT = "VALID_REPORT",
	STARBOARD_MESSAGE = "STARBOARD_MESSAGE",

	// Negative events
	WARNING_MINOR = "WARNING_MINOR",
	WARNING_MODERATE = "WARNING_MODERATE",
	WARNING_SEVERE = "WARNING_SEVERE",
	TIMEOUT = "TIMEOUT",
	SPAM_DELETED = "SPAM_DELETED",
	TOXIC_CONTENT = "TOXIC_CONTENT",

	// Manual adjustments
	MANUAL_GRANT = "MANUAL_GRANT",
	MANUAL_DEDUCT = "MANUAL_DEDUCT",
}

// Score values for each event type
export const REPUTATION_SCORES: Record<ReputationEventType, number> = {
	[ReputationEventType.HELPED_USER]: 10,
	[ReputationEventType.QUALITY_CONTRIBUTION]: 15,
	[ReputationEventType.VALID_REPORT]: 20,
	[ReputationEventType.STARBOARD_MESSAGE]: 5,

	[ReputationEventType.WARNING_MINOR]: -20,
	[ReputationEventType.WARNING_MODERATE]: -40,
	[ReputationEventType.WARNING_SEVERE]: -75,
	[ReputationEventType.TIMEOUT]: -15,
	[ReputationEventType.SPAM_DELETED]: -5,
	[ReputationEventType.TOXIC_CONTENT]: -10,

	[ReputationEventType.MANUAL_GRANT]: 0, // Custom amount
	[ReputationEventType.MANUAL_DEDUCT]: 0, // Custom amount
};

export const REPUTATION_EVENT_LABELS: Record<ReputationEventType, string> = {
	[ReputationEventType.HELPED_USER]: "Helped User",
	[ReputationEventType.QUALITY_CONTRIBUTION]: "Quality Contribution",
	[ReputationEventType.VALID_REPORT]: "Valid Report",
	[ReputationEventType.STARBOARD_MESSAGE]: "Starboard Message",

	[ReputationEventType.WARNING_MINOR]: "Warning (Minor)",
	[ReputationEventType.WARNING_MODERATE]: "Warning (Moderate)",
	[ReputationEventType.WARNING_SEVERE]: "Warning (Severe)",
	[ReputationEventType.TIMEOUT]: "Timeout",
	[ReputationEventType.SPAM_DELETED]: "Spam Deleted",
	[ReputationEventType.TOXIC_CONTENT]: "Toxic Content",

	[ReputationEventType.MANUAL_GRANT]: "Manual Grant",
	[ReputationEventType.MANUAL_DEDUCT]: "Manual Deduction",
};

@Table({ tableName: "ReputationEvents" })
export class ReputationEvent extends Model<
	InferAttributes<ReputationEvent>,
	InferCreationAttributes<ReputationEvent>
> {
	@Attribute(DataTypes.INTEGER)
	@PrimaryKey
	@AutoIncrement
	public declare id: CreationOptional<number>;

	@Attribute(RealBigInt)
	@NotNull
	public declare userId: bigint;

	@Attribute(DataTypes.STRING(30))
	@NotNull
	public declare eventType: ReputationEventType;

	@Attribute(DataTypes.INTEGER)
	@NotNull
	public declare scoreChange: number;

	@Attribute(DataTypes.STRING(500))
	public declare reason: string | null;

	@Attribute(RealBigInt)
	public declare grantedBy: bigint | null;

	@Attribute(DataTypes.INTEGER)
	public declare relatedId: number | null; // e.g., warning ID, starboard message ID

	@Attribute(DataTypes.DATE)
	@Default(DataTypes.NOW)
	public declare createdAt: CreationOptional<Date>;
}

/**
 * Create a reputation event and return the score change
 */
export async function createReputationEvent(
	userId: bigint,
	eventType: ReputationEventType,
	options?: {
		reason?: string;
		grantedBy?: bigint;
		relatedId?: number;
		customScore?: number;
	},
): Promise<ReputationEvent> {
	const scoreChange = options?.customScore ?? REPUTATION_SCORES[eventType];

	return ReputationEvent.create({
		userId,
		eventType,
		scoreChange,
		reason: options?.reason ?? null,
		grantedBy: options?.grantedBy ?? null,
		relatedId: options?.relatedId ?? null,
	});
}

/**
 * Get all reputation events for a user
 */
export async function getReputationHistory(
	userId: bigint,
	limit = 50,
): Promise<ReputationEvent[]> {
	return ReputationEvent.findAll({
		where: { userId },
		order: [["createdAt", "DESC"]],
		limit,
	});
}

/**
 * Calculate total reputation score for a user
 */
export async function calculateReputationScore(
	userId: bigint,
): Promise<number> {
	const events = await ReputationEvent.findAll({
		where: { userId },
		attributes: ["scoreChange"],
	});

	return events.reduce((sum, event) => sum + event.scoreChange, 0);
}

/**
 * Get reputation events within a time window
 */
export async function getRecentReputationEvents(
	userId: bigint,
	windowMs: number,
): Promise<ReputationEvent[]> {
	const since = new Date(Date.now() - windowMs);
	return ReputationEvent.findAll({
		where: {
			userId,
			createdAt: { [Op.gte]: since },
		},
		order: [["createdAt", "DESC"]],
	});
}
