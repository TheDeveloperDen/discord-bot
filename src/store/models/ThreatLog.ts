import {
	type CreationOptional,
	DataTypes,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "@sequelize/core";
import {
	AllowNull,
	Attribute,
	AutoIncrement,
	BelongsTo,
	Default,
	NotNull,
	PrimaryKey,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { DDUser } from "./DDUser.js";

export enum ThreatType {
	SPAM = "SPAM",
	RAID = "RAID",
	MENTION_SPAM = "MENTION_SPAM",
	SCAM_LINK = "SCAM_LINK",
	TOXIC_CONTENT = "TOXIC_CONTENT",
	SUSPICIOUS_ACCOUNT = "SUSPICIOUS_ACCOUNT",
}

export enum ThreatAction {
	FLAGGED = "FLAGGED",
	DELETED = "DELETED",
	WARNED = "WARNED",
	MUTED = "MUTED",
	KICKED = "KICKED",
	BANNED = "BANNED",
}

@Table({ tableName: "ThreatLogs" })
export class ThreatLog extends Model<
	InferAttributes<ThreatLog>,
	InferCreationAttributes<ThreatLog>
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
	public declare threatType: ThreatType;

	@Attribute(DataTypes.FLOAT)
	@NotNull
	public declare severity: number;

	@Attribute(DataTypes.STRING(20))
	@NotNull
	public declare actionTaken: ThreatAction;

	@Attribute(DataTypes.TEXT)
	@AllowNull
	public declare messageContent: string | null;

	@Attribute(RealBigInt)
	@AllowNull
	public declare messageId: bigint | null;

	@Attribute(RealBigInt)
	@AllowNull
	public declare channelId: bigint | null;

	@Attribute(DataTypes.JSON)
	@AllowNull
	public declare metadata: Record<string, unknown> | null;

	@Attribute(DataTypes.BOOLEAN)
	@Default(false)
	public declare falsePositive: CreationOptional<boolean>;

	@Attribute(RealBigInt)
	@AllowNull
	public declare reviewedBy: bigint | null;

	@Attribute(DataTypes.DATE)
	@Default(DataTypes.NOW)
	public declare createdAt: CreationOptional<Date>;

	@BelongsTo(() => DDUser, "userId")
	public declare user?: DDUser;
}
