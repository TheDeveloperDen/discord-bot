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
	BelongsTo,
	Default,
	Index,
	NotNull,
	PrimaryKey,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";
import { DDUser } from "./DDUser.js";

@Table({
	tableName: "ReactionStats",
	indexes: [
		{
			name: "idx_reactionstats_user_reacted",
			fields: ["userId", "reactedAt"],
		},
		{
			name: "idx_reactionstats_message",
			fields: ["messageId"],
		},
		{
			name: "idx_reactionstats_author_reacted",
			fields: ["messageAuthorId", "reactedAt"],
		},
		{
			name: "idx_reactionstats_emoji_reacted",
			fields: ["emojiName", "reactedAt"],
		},
		{
			name: "idx_reactionstats_reacted_at",
			fields: ["reactedAt"],
		},
		{
			name: "unique_user_message_emoji",
			unique: true,
			fields: ["userId", "messageId", "emojiName"],
		},
	],
})
export class ReactionStat extends Model<
	InferAttributes<ReactionStat>,
	InferCreationAttributes<ReactionStat>
> {
	@Attribute(DataTypes.INTEGER)
	@PrimaryKey
	@AutoIncrement
	public declare id: CreationOptional<number>;

	/** The user who added the reaction */
	@Attribute(RealBigInt)
	@NotNull
	public declare userId: bigint;

	/** The message that was reacted to */
	@Attribute(RealBigInt)
	@NotNull
	public declare messageId: bigint;

	/** The author of the message that was reacted to */
	@Attribute(RealBigInt)
	@NotNull
	public declare messageAuthorId: bigint;

	/** The channel the message is in */
	@Attribute(RealBigInt)
	@NotNull
	public declare channelId: bigint;

	/** Emoji identifier: unicode char for standard, name for custom */
	@Attribute(DataTypes.STRING)
	@NotNull
	public declare emojiName: string;

	/** Custom emoji snowflake ID, null for standard unicode emojis */
	@AllowNull
	@Attribute(RealBigInt)
	public declare emojiId: bigint | null;

	/** Whether this is a custom guild emoji */
	@Attribute(DataTypes.BOOLEAN)
	@NotNull
	@Default(false)
	public declare isCustomEmoji: CreationOptional<boolean>;

	/** When the reaction was added — used for time-based filtering */
	@Attribute(DataTypes.DATE)
	@NotNull
	@Index({ name: "idx_reactionstats_reacted_at" })
	public declare reactedAt: Date;

	@BelongsTo(() => DDUser, "userId")
	public declare user?: DDUser;

	@BelongsTo(() => DDUser, "messageAuthorId")
	public declare messageAuthor?: DDUser;

	public declare createdAt: CreationOptional<Date>;
	public declare updatedAt: CreationOptional<Date>;
}
