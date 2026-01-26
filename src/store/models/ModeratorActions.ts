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
	ColumnName,
	Default,
	NotNull,
	PrimaryKey,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { DDUser } from "./DDUser.js";

export enum ModeratorAction {
	TEMPBAN = "TEMPBAN",
}

@Table({ tableName: "ModeratorActions" })
export class ModeratorActions extends Model<
	InferAttributes<ModeratorActions>,
	InferCreationAttributes<ModeratorActions>
> {
	@Attribute(DataTypes.INTEGER)
	@PrimaryKey
	@AutoIncrement
	public declare id: CreationOptional<number>;

	@Attribute(RealBigInt)
	@NotNull
	public declare ddUserId: bigint;

	@Attribute(RealBigInt)
	@NotNull
	public declare moderatorId: bigint;

	@Attribute(DataTypes.ENUM(ModeratorAction))
	@NotNull
	@ColumnName("action")
	public declare action: ModeratorAction;

	@Attribute(DataTypes.STRING)
	@AllowNull
	public declare reason: string | null;

	@Attribute(DataTypes.DATE)
	@AllowNull
	public declare expires: Date | null;

	@Attribute(DataTypes.BOOLEAN)
	@Default(false)
	public declare expired: CreationOptional<boolean>;

	@BelongsTo(() => DDUser, "ddUserId")
	public declare ddUser?: DDUser;

	@BelongsTo(() => DDUser, "moderatorId")
	public declare moderator?: DDUser;
}
