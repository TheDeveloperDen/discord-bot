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
  HasMany,
  NotNull,
  PrimaryKey,
  Table,
  Unique,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { SuggestionVote } from "./SuggestionVote.js";

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
  @ColumnName("userId")
  public userId!: bigint;

  @Attribute(DataTypes.STRING)
  @NotNull
  @ColumnName("suggestionText")
  public suggestionText!: string;

  @Attribute(DataTypes.STRING)
  @AllowNull
  @ColumnName("suggestionImageUrl")
  public suggestionImageUrl: string | undefined;

  // Define the association
  @HasMany(() => SuggestionVote, "suggestionId")
  declare public votes?: SuggestionVote[];
}
