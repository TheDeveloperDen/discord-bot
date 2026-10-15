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
	@Attribute(DataTypes.INTEGER)
	@PrimaryKey
	@AutoIncrement
	declare public id: CreationOptional<number>;

	@Attribute(RealBigInt)
	@NotNull
	declare public creatorId: bigint;

	@Attribute(RealBigInt)
	@AllowNull
	declare public assignedUserId?: bigint;

	@Attribute(RealBigInt)
	@AllowNull
	declare public threadId?: bigint;

	@Attribute(RealBigInt)
	@AllowNull
	declare public channelId?: bigint;

	@Attribute({
		type: DataTypes.STRING,
		columnName: "archiveMessageId",
	})
	@AllowNull
	declare public detailsMessageIds?: string;

	@Attribute(DataTypes.ENUM(ModMailTicketStatus))
	@Default(ModMailTicketStatus.OPEN)
	@NotNull
	declare public status: CreationOptional<ModMailTicketStatus>;

	@Attribute(DataTypes.ENUM(ModMailTicketCategory))
	@Default(ModMailTicketCategory.QUESTION)
	@NotNull
	declare public category: CreationOptional<ModMailTicketCategory>;

	@HasMany(() => ModMailNote, "modMailTicketId")
	declare public notes?: ModMailNote[];
}
