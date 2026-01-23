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
	public declare id: CreationOptional<number>;

	@Attribute(RealBigInt)
	@NotNull
	public declare userId: bigint;

	@Attribute(RealBigInt)
	@NotNull
	public declare moderatorId: bigint;

	@Attribute(DataTypes.TEXT)
	@NotNull
	public declare reason: string;

	@Attribute(DataTypes.INTEGER)
	@Default(WarningSeverity.MINOR)
	@NotNull
	public declare severity: WarningSeverity;

	@Attribute(DataTypes.DATE)
	@AllowNull
	public declare expiresAt: Date | null;

	@Attribute(DataTypes.BOOLEAN)
	@Default(false)
	public declare expired: CreationOptional<boolean>;

	@Attribute(DataTypes.BOOLEAN)
	@Default(false)
	public declare pardoned: CreationOptional<boolean>;

	@Attribute(RealBigInt)
	@AllowNull
	public declare pardonedBy: bigint | null;

	@Attribute(DataTypes.TEXT)
	@AllowNull
	public declare pardonReason: string | null;

	public declare createdAt: CreationOptional<Date>;
	public declare updatedAt: CreationOptional<Date>;

	@BelongsTo(() => DDUser, "userId")
	public declare user?: DDUser;
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
