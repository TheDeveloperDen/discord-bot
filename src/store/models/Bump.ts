import {
	DataTypes,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "@sequelize/core";
import {
	Attribute,
	Index,
	NotNull,
	PrimaryKey,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";

@Table({ tableName: "Bumps" })
export class Bump extends Model<
	InferAttributes<Bump>,
	InferCreationAttributes<Bump>
> {
	@Attribute(RealBigInt)
	@PrimaryKey
	@NotNull
	public declare messageId: bigint;

	@Attribute(RealBigInt)
	@NotNull
	public declare userId: bigint;

	@Attribute(DataTypes.DATE)
	@NotNull
	@Index
	public declare timestamp: Date;
}
