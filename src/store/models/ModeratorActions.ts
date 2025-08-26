import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "@sequelize/core";
import {
  AllowNull,
  Attribute,
  AutoIncrement,
  BelongsTo,
  ColumnName,
  Default,
  NotNull,
  PrimaryKey,
  Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { DDUser } from "./DDUser.js";

export enum ModeratorAction {
  TEMPBAN = "TEMPBAN",
}

@Table({ tableName: "ModeratorActions" })
export class ModeratorActions extends Model<
  InferAttributes<ModeratorActions>,
  InferCreationAttributes<ModeratorActions>
> {
  @Attribute(RealBigInt)
  @PrimaryKey
  @AutoIncrement
  declare public id: CreationOptional<bigint>;

  @Attribute(RealBigInt)
  @NotNull
  declare public dduserId: bigint;

  @Attribute(RealBigInt)
  @NotNull
  declare public moderatorId: bigint;

  @Attribute(DataTypes.ENUM(ModeratorAction))
  @NotNull
  @ColumnName("action")
  declare public action: ModeratorAction;

  @Attribute(DataTypes.STRING)
  @AllowNull
  declare public reason: string | null;

  @Attribute(DataTypes.DATE)
  @AllowNull
  declare public expires: Date | null;

  @Attribute(DataTypes.BOOLEAN)
  @Default(false)
  declare public expired: CreationOptional<boolean>;

  @BelongsTo(() => DDUser, "dduserId")
  declare public ddUser?: DDUser;

  @BelongsTo(() => DDUser, "moderatorId")
  declare public moderator?: DDUser;
}
