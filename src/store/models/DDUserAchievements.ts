import {
	type CreationOptional,
	DataTypes,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "@sequelize/core";
import {
	Attribute,
	AutoIncrement,
	BelongsTo,
	ColumnName,
	NotNull,
	PrimaryKey,
	Table,
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
	@Attribute(DataTypes.INTEGER)
	@PrimaryKey
	@AutoIncrement
	declare public id: CreationOptional<number>;

	@Attribute(DataTypes.STRING)
	@NotNull
	@ColumnName("achievementId")
	declare public achievementId: string;

	@Attribute(RealBigInt)
	@NotNull
	declare public ddUserId: bigint;

	@BelongsTo(() => DDUser, "ddUserId")
	declare public ddUser?: DDUser;

	// Sequelize automatically manages these timestamps with paranoid: true
	declare public createdAt: CreationOptional<Date>;
	declare public updatedAt: CreationOptional<Date>;
	declare public deletedAt: CreationOptional<Date | null>;
}
