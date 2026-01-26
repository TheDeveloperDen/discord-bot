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
	public declare id: CreationOptional<number>;

	@Attribute(DataTypes.STRING)
	@NotNull
	@ColumnName("achievementId")
	public declare achievementId: string;

	@Attribute(RealBigInt)
	@NotNull
	public declare ddUserId: bigint;

	@BelongsTo(() => DDUser, "ddUserId")
	public declare ddUser?: DDUser;

	// Sequelize automatically manages these timestamps with paranoid: true
	public declare createdAt: CreationOptional<Date>;
	public declare updatedAt: CreationOptional<Date>;
	public declare deletedAt: CreationOptional<Date | null>;
}
