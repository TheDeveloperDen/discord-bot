import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
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
})
export class Suggestion extends Model<
  InferAttributes<Suggestion>,
  InferCreationAttributes<Suggestion>
> {
  @Attribute(RealBigInt)
  @PrimaryKey
  @Unique
  @NotNull
  declare public id: bigint;

  @Attribute(RealBigInt)
  @NotNull
  @ColumnName("messageId")
  public messageId!: bigint;

  @Attribute(RealBigInt)
  @NotNull
  @ColumnName("memberId")
  public memberId!: bigint;

  @Attribute(DataTypes.STRING)
  @NotNull
  @ColumnName("suggestionText")
  public suggestionText!: string;

  @Attribute(DataTypes.STRING)
  @AllowNull
  @ColumnName("suggestionImageUrl")
  public suggestionImageUrl: string | undefined;

  @Attribute(DataTypes.ENUM(SuggestionStatus))
  @Default(SuggestionStatus.PENDING)
  @NotNull
  @ColumnName("status")
  public status: SuggestionStatus = SuggestionStatus.PENDING;

  @Attribute(RealBigInt)
  @AllowNull
  @ColumnName("moderatorId")
  declare public moderatorId: bigint | undefined;

  @HasMany(() => SuggestionVote, "suggestionId")
  declare public votes?: SuggestionVote[];
}
