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
	NotNull,
	PrimaryKey,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { ModMailTicket } from "./ModMailTicket.js";

@Table({
	tableName: "ModMailNote",
	timestamps: true,
})
export class ModMailNote extends Model<
	InferAttributes<ModMailNote>,
	InferCreationAttributes<ModMailNote>
> {
	@Attribute(DataTypes.INTEGER)
	@PrimaryKey
	@AutoIncrement
	public declare id: CreationOptional<number>;

	@Attribute(DataTypes.INTEGER)
	@NotNull
	public modMailTicketId!: number;

	@Attribute(RealBigInt)
	@NotNull
	public authorId!: bigint;

	@Attribute(DataTypes.TEXT)
	@NotNull
	public content!: string;

	@Attribute(RealBigInt)
	@AllowNull
	public updatedBy?: bigint;

	@Attribute(DataTypes.DATE)
	@AllowNull
	public contentUpdatedAt?: Date;

	public declare createdAt: CreationOptional<Date>;
	public declare updatedAt: CreationOptional<Date>;

	@BelongsTo(() => ModMailTicket, {
		foreignKey: "modMailTicketId",
	})
	public declare modMailTicket?: ModMailTicket;
}
