import {
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "@sequelize/core";
import {
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
}
