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

export enum WarningSeverity {
	MINOR = 1,
	MODERATE = 2,
	SEVERE = 3,
}

@Table({ tableName: "Warnings", timestamps: true })
export class Warning extends Model<
	InferAttributes<Warning>,
	InferCreationAttributes<Warning>
> {
	@Attribute(DataTypes.INTEGER)
	@PrimaryKey
	@AutoIncrement
	declare public id: CreationOptional<number>;

	@Attribute(RealBigInt)
	@NotNull
	declare public userId: bigint;

	@Attribute(RealBigInt)
	@NotNull
	declare public moderatorId: bigint;

	@Attribute(DataTypes.TEXT)
	@NotNull
	declare public reason: string;

	@Attribute(DataTypes.INTEGER)
	@Default(WarningSeverity.MINOR)
	@NotNull
	declare public severity: WarningSeverity;

	@Attribute(DataTypes.DATE)
	@AllowNull
	declare public expiresAt: Date | null;

	@Attribute(DataTypes.BOOLEAN)
	@Default(false)
	declare public expired: CreationOptional<boolean>;

	@Attribute(DataTypes.BOOLEAN)
	@Default(false)
	declare public pardoned: CreationOptional<boolean>;

	@Attribute(RealBigInt)
	@AllowNull
	declare public pardonedBy: bigint | null;

	@Attribute(DataTypes.TEXT)
	@AllowNull
	declare public pardonReason: string | null;

	declare public createdAt: CreationOptional<Date>;
	declare public updatedAt: CreationOptional<Date>;

	@BelongsTo(() => DDUser, "userId")
	declare public user?: DDUser;
}

export async function getActiveWarnings(userId: bigint): Promise<Warning[]> {
	return Warning.findAll({
		where: {
			userId,
			expired: false,
			pardoned: false,
		},
		order: [["createdAt", "DESC"]],
	});
}

export async function getWarningCount(userId: bigint): Promise<number> {
	return Warning.count({
		where: {
			userId,
			expired: false,
			pardoned: false,
		},
	});
}

export async function getAllWarnings(
	userId: bigint,
	includeExpired = false,
): Promise<Warning[]> {
	const where: Record<string, unknown> = { userId };
	if (!includeExpired) {
		where.expired = false;
		where.pardoned = false;
	}
	return Warning.findAll({
		where,
		order: [["createdAt", "DESC"]],
	});
}
