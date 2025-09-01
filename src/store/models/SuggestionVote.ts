import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "@sequelize/core";
import {
  AllowNull,
  Attribute,
  BelongsTo,
  ColumnName,
  NotNull,
  Table,
  Unique,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { Suggestion } from "./Suggestion.js";

@Table({
  tableName: "SuggestionVote",
})
export class SuggestionVote extends Model<
  InferAttributes<SuggestionVote>,
  InferCreationAttributes<SuggestionVote>
> {
  @Attribute(RealBigInt)
  @NotNull
  @ColumnName("suggestionId")
  @Unique("unique_suggestion_member")
  public suggestionId!: bigint;

  @Attribute(RealBigInt)
  @NotNull
  @ColumnName("memberId")
  @Unique("unique_suggestion_member")
  public memberId!: bigint;

  @Attribute(DataTypes.TINYINT)
  @AllowNull
  @ColumnName("vote")
  public vote!: number;

  @BelongsTo(() => Suggestion, "suggestionId")
  declare public suggestion?: Suggestion;
}
