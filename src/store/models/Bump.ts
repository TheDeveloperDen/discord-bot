import {
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
} from "@sequelize/core";
import {
  Attribute,
  Index,
  NotNull,
  PrimaryKey,
  Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";

@Table({ tableName: "Bumps" })
export class Bump extends Model<
  InferAttributes<Bump>,
  InferCreationAttributes<Bump>
> {
  @Attribute(RealBigInt)
  @PrimaryKey
  @NotNull
  declare public messageId: bigint;

  @Attribute(RealBigInt)
  @NotNull
  declare public userId: bigint;

  @Attribute(DataTypes.DATE)
  @NotNull
  @Index
  declare public timestamp: Date;
}
