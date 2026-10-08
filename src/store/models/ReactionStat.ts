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
			name: "unique_user_message_unicode_emoji",
			unique: true,
			fields: ["userId", "messageId", "emojiName"],
			where: {
				isCustomEmoji: false,
			},
		},
		{
			name: "unique_user_message_custom_emoji",
			unique: true,
			fields: ["userId", "messageId", "emojiId"],
			where: {
				isCustomEmoji: true,
			},
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
	declare public id: CreationOptional<number>;

	/** The user who added the reaction */
	@Attribute(RealBigInt)
	@NotNull
	declare public userId: bigint;

	/** The message that was reacted to */
	@Attribute(RealBigInt)
	@NotNull
	declare public messageId: bigint;

	/** The author of the message that was reacted to */
	@Attribute(RealBigInt)
	@NotNull
	declare public messageAuthorId: bigint;

	/** The channel the message is in */
	@Attribute(RealBigInt)
	@NotNull
	declare public channelId: bigint;

	/** Emoji identifier: unicode char for standard, name for custom */
	@Attribute(DataTypes.STRING)
	@NotNull
	declare public emojiName: string;

	/** Custom emoji snowflake ID, null for standard unicode emojis */
	@AllowNull
	@Attribute(RealBigInt)
	declare public emojiId: bigint | null;

	/** Whether this is a custom guild emoji */
	@Attribute(DataTypes.BOOLEAN)
	@NotNull
	@Default(false)
	declare public isCustomEmoji: CreationOptional<boolean>;

	/** When the reaction was added — used for time-based filtering */
	@Attribute(DataTypes.DATE)
	@NotNull
	@Index({ name: "idx_reactionstats_reacted_at" })
	declare public reactedAt: Date;

	@BelongsTo(() => DDUser, "userId")
	declare public user?: DDUser;

	@BelongsTo(() => DDUser, "messageAuthorId")
	declare public messageAuthor?: DDUser;

	declare public createdAt: CreationOptional<Date>;
	declare public updatedAt: CreationOptional<Date>;
}
