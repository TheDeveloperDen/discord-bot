import {
	type CreationOptional,
	DataTypes,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "@sequelize/core";
import {
	Attribute,
	AutoIncrement,
	Default,
	NotNull,
	PrimaryKey,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";

export enum BlockedWordCategory {
	SLUR = "SLUR",
	HARASSMENT = "HARASSMENT",
	SPAM = "SPAM",
	NSFW = "NSFW",
	OTHER = "OTHER",
}

@Table({ tableName: "BlockedWords" })
export class BlockedWord extends Model<
	InferAttributes<BlockedWord>,
	InferCreationAttributes<BlockedWord>
> {
	@Attribute(DataTypes.INTEGER)
	@PrimaryKey
	@AutoIncrement
	public declare id: CreationOptional<number>;

	@Attribute(DataTypes.STRING(100))
	@NotNull
	public declare word: string;

	@Attribute(DataTypes.STRING(20))
	@NotNull
	@Default(BlockedWordCategory.OTHER)
	public declare category: CreationOptional<BlockedWordCategory>;

	@Attribute(RealBigInt)
	@NotNull
	public declare addedBy: bigint;

	@Attribute(DataTypes.DATE)
	@Default(DataTypes.NOW)
	public declare createdAt: CreationOptional<Date>;
}

export async function getAllBlockedWords(): Promise<BlockedWord[]> {
	return BlockedWord.findAll();
}

export async function getBlockedWordsByCategory(
	category: BlockedWordCategory,
): Promise<BlockedWord[]> {
	return BlockedWord.findAll({ where: { category } });
}

export async function addBlockedWord(
	word: string,
	category: BlockedWordCategory,
	addedBy: bigint,
): Promise<BlockedWord> {
	const normalized = word.toLowerCase().trim();
	const [blockedWord] = await BlockedWord.findOrCreate({
		where: { word: normalized },
		defaults: { word: normalized, category, addedBy },
	});
	return blockedWord;
}

export async function removeBlockedWord(word: string): Promise<boolean> {
	const normalized = word.toLowerCase().trim();
	const deleted = await BlockedWord.destroy({ where: { word: normalized } });
	return deleted > 0;
}

export async function isWordBlocked(word: string): Promise<BlockedWord | null> {
	const normalized = word.toLowerCase().trim();
	return BlockedWord.findOne({ where: { word: normalized } });
}
