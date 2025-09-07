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
	NotNull,
	PrimaryKey,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";

@Table({ tableName: "FAQs" })
export class FAQ extends Model<
	InferAttributes<FAQ>,
	InferCreationAttributes<FAQ>
> {
	@Attribute(DataTypes.INTEGER)
	@PrimaryKey
	@AutoIncrement
	public declare id: CreationOptional<number>;

	@Attribute(RealBigInt)
	@NotNull
	public declare author: bigint;

	@Attribute(DataTypes.STRING(64))
	@NotNull
	public declare name: string;

	@Attribute(DataTypes.STRING(64))
	@NotNull
	public declare title: string;

	@Attribute(DataTypes.TEXT("long"))
	@NotNull
	public declare content: string;
}
