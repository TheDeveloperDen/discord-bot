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
	Default,
	HasMany,
	NotNull,
	PrimaryKey,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { ModMailNote } from "./ModMailNote.js";

export enum ModMailTicketStatus {
	OPEN = "OPEN",
	ARCHIVED = "ARCHIVED",
}

export enum ModMailTicketCategory {
	QUESTION = "QUESTION",
	BUG = "BUG",
	SUGGESTION = "SUGGESTION",
	OTHER = "OTHER",
}

@Table({
	tableName: "ModMailTicket",
})
export class ModMailTicket extends Model<
	InferAttributes<ModMailTicket>,
	InferCreationAttributes<ModMailTicket>
> {
	@Attribute(RealBigInt)
	@PrimaryKey
	@AutoIncrement
	public declare id: CreationOptional<bigint>;

	@Attribute(RealBigInt)
	@NotNull
	public declare creatorId: bigint;

	@Attribute(RealBigInt)
	@AllowNull
	public declare assignedUserId?: bigint;

	@Attribute(RealBigInt)
	@AllowNull
	public declare threadId?: bigint;

	@Attribute(RealBigInt)
	@AllowNull
	public declare channelId?: bigint;

	@Attribute(DataTypes.STRING)
	@AllowNull
	public declare archiveMessageId?: string;

	@Attribute(DataTypes.ENUM(ModMailTicketStatus))
	@Default(ModMailTicketStatus.OPEN)
	@NotNull
	public status: ModMailTicketStatus = ModMailTicketStatus.OPEN;

	@Attribute(DataTypes.ENUM(ModMailTicketCategory))
	@Default(ModMailTicketCategory.QUESTION)
	@NotNull
	public category: ModMailTicketCategory = ModMailTicketCategory.QUESTION;

	@HasMany(() => ModMailNote, "modMailTicketId")
	public declare notes?: ModMailNote[];
}
