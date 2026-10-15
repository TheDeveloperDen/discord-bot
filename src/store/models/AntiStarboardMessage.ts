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
	NotNull,
	PrimaryKey,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";

@Table({ tableName: "AntiStarboardMessages" })
export class AntiStarboardMessage extends Model<
	InferAttributes<AntiStarboardMessage>,
	InferCreationAttributes<AntiStarboardMessage>
> {
	@Attribute(RealBigInt)
	@PrimaryKey
	@NotNull
	public originalMessageId!: bigint;

	@Attribute(RealBigInt)
	@NotNull
	public originalMessageChannelId!: bigint;

	@Attribute(RealBigInt)
	@NotNull
	public starboardMessageId!: bigint;

	/** When the post was moved to the mod log because its original message was deleted */
	@Attribute(DataTypes.DATE)
	@AllowNull
	declare public removedAt: CreationOptional<Date | null>;
}
