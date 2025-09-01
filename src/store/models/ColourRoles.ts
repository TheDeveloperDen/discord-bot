import {
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "@sequelize/core";
import {
	Attribute,
	ColumnName,
	NotNull,
	PrimaryKey,
	Table,
	Unique,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";

@Table({
	tableName: "RoleColours",
})
export class ColourRoles extends Model<
	InferAttributes<ColourRoles>,
	InferCreationAttributes<ColourRoles>
> {
	@Attribute(RealBigInt)
	@PrimaryKey
	@Unique
	@NotNull
	public declare id: bigint;

	@Attribute(RealBigInt)
	@NotNull
	@ColumnName("colourRole")
	public role!: bigint;
}
