import {
	DataTypes,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "@sequelize/core";
import {
	AllowNull,
	Attribute,
	ColumnName,
	Default,
	HasMany,
	NotNull,
	PrimaryKey,
	Table,
	Unique,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { SuggestionVote } from "./SuggestionVote.js";

export enum SuggestionStatus {
	PENDING = "PENDING",
	APPROVED = "APPROVED",
	REJECTED = "REJECTED",
}

@Table({
	tableName: "Suggestion",
	paranoid: true,
})
export class Suggestion extends Model<
	InferAttributes<Suggestion>,
	InferCreationAttributes<Suggestion>
> {
	@Attribute(RealBigInt)
	@PrimaryKey
	@Unique
	@NotNull
	public declare id: bigint;

	@Attribute(RealBigInt)
	@NotNull
	@ColumnName("messageId")
	public messageId!: bigint;

	@Attribute(RealBigInt)
	@NotNull
	@ColumnName("memberId")
	public memberId!: bigint;

	@Attribute(DataTypes.TEXT)
	@NotNull
	@ColumnName("suggestionText")
	public suggestionText!: string;

	@Attribute(DataTypes.ENUM(SuggestionStatus))
	@Default(SuggestionStatus.PENDING)
	@NotNull
	@ColumnName("status")
	public status: SuggestionStatus = SuggestionStatus.PENDING;

	@Attribute(RealBigInt)
	@AllowNull
	@ColumnName("moderatorId")
	public declare moderatorId: bigint | undefined;

	@HasMany(() => SuggestionVote, "suggestionId")
	public declare votes?: SuggestionVote[];
}
