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
	declare public id: CreationOptional<number>;

	@Attribute(RealBigInt)
	@NotNull
	declare public userId: bigint;

	@Attribute(DataTypes.STRING(30))
	@NotNull
	declare public threatType: ThreatType;

	@Attribute(DataTypes.FLOAT)
	@NotNull
	declare public severity: number;

	@Attribute(DataTypes.STRING(20))
	@NotNull
	declare public actionTaken: ThreatAction;

	@Attribute(DataTypes.TEXT)
	@AllowNull
	declare public messageContent: string | null;

	@Attribute(RealBigInt)
	@AllowNull
	declare public messageId: bigint | null;

	@Attribute(RealBigInt)
	@AllowNull
	declare public channelId: bigint | null;

	@Attribute(DataTypes.JSON)
	@AllowNull
	declare public metadata: Record<string, unknown> | null;

	@Attribute(DataTypes.BOOLEAN)
	@Default(false)
	declare public falsePositive: CreationOptional<boolean>;

	@Attribute(RealBigInt)
	@AllowNull
	declare public reviewedBy: bigint | null;

	@Attribute(DataTypes.DATE)
	@Default(DataTypes.NOW)
	declare public createdAt: CreationOptional<Date>;

	@BelongsTo(() => DDUser, "userId")
	declare public user?: DDUser;
}
