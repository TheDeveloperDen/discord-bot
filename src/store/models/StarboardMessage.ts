import {
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "@sequelize/core";

import {
  Attribute,
  NotNull,
  PrimaryKey,
  Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";

@Table({ tableName: "StarboardMessages" })
export class StarboardMessage extends Model<
  InferAttributes<StarboardMessage>,
  InferCreationAttributes<StarboardMessage>
> {
  @Attribute(RealBigInt)
  @PrimaryKey
  @NotNull
  public originalMessageId!: bigint;

  @Attribute(RealBigInt)
  @NotNull
  public originalMessageChannelId!: bigint;

  @Attribute(RealBigInt)
  @NotNull
  public starboardMessageId!: bigint;
}
