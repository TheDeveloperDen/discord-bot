import {
	DataTypes,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "@sequelize/core";
import {
	Attribute,
	BelongsTo,
	ColumnName,
	NotNull,
	PrimaryKey,
	Table,
	Unique,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { DDUser } from "./DDUser.js";

@Table({
	tableName: "DDUserAchievements",
	paranoid: true,
	indexes: [
		{
			name: "unique_achievement_ddUserId",
			unique: true,
			fields: ["achievementId", "ddUserId"],
		},
	],
})
export class DDUserAchievements extends Model<
	InferAttributes<DDUserAchievements>,
	InferCreationAttributes<DDUserAchievements>
> {
	@Attribute(RealBigInt)
	@PrimaryKey
	@Unique
	@NotNull
	public declare id: bigint;

	@Attribute(DataTypes.STRING)
	@NotNull
	@ColumnName("achievementId")
	public declare achievementId: string;

	@Attribute(RealBigInt)
	@NotNull
	public declare ddUserId: bigint;

	@BelongsTo(() => DDUser, "ddUserId")
	public declare ddUser?: DDUser;
}
