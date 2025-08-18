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
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { Suggestion } from "./Suggestion.js";

@Table({
  tableName: "SuggestionVotes",
})
export class SuggestionVotes extends Model<
  InferAttributes<SuggestionVotes>,
  InferCreationAttributes<SuggestionVotes>
> {
  @Attribute(RealBigInt)
  @NotNull
  @ColumnName("suggestionId")
  public suggestionId!: bigint;

  @Attribute(RealBigInt)
  @NotNull
  @ColumnName("messageId")
  public memberId!: bigint;

  @Attribute(DataTypes.TINYINT)
  @AllowNull
  @ColumnName("suggestionImageUrl")
  public vote!: number;

  @BelongsTo(() => Suggestion, "suggestionId")
  declare public suggestion?: Suggestion;
}
