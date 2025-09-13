import {
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "@sequelize/core";
import {
	Attribute,
	BelongsTo,
	NotNull,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { ModMailTicket } from "./ModMailTicket.js";

@Table({
	tableName: "ModMailNote",
})
export class ModMailNote extends Model<
	InferAttributes<ModMailNote>,
	InferCreationAttributes<ModMailNote>
> {
	@Attribute(RealBigInt)
	@NotNull
	public modMailTicketId!: bigint;

	@Attribute(RealBigInt)
	@NotNull
	public authorId!: bigint;

	@Attribute(RealBigInt)
	@NotNull
	public messageId!: bigint;

	@BelongsTo(() => ModMailTicket, "modMailTicketId")
	public declare modMailTicket?: ModMailTicket;
}
