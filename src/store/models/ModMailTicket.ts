import {
  type CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "@sequelize/core";
import {
  AllowNull,
  Attribute,
  AutoIncrement,
  Default,
  NotNull,
  PrimaryKey,
  Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";

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
  declare public id: CreationOptional<bigint>;

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

  @Attribute(DataTypes.ENUM(ModMailTicketStatus))
  @Default(ModMailTicketStatus.OPEN)
  @NotNull
  public status: ModMailTicketStatus = ModMailTicketStatus.OPEN;

  @Attribute(DataTypes.ENUM(ModMailTicketCategory))
  @Default(ModMailTicketCategory.QUESTION)
  @NotNull
  public category: ModMailTicketCategory = ModMailTicketCategory.QUESTION;
}
