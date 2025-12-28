import {
	type CreationOptional,
	DataTypes,
	type InferAttributes,
	type InferCreationAttributes,
	Model,
} from "@sequelize/core";
import {
	Attribute,
	Default,
	NotNull,
	PrimaryKey,
	Table,
} from "@sequelize/core/decorators-legacy";
import { RealBigInt } from "../RealBigInt.js";

export enum ScamDomainCategory {
	SCAM = "SCAM",
	PHISHING = "PHISHING",
	MALWARE = "MALWARE",
	SHORTENER = "SHORTENER",
}

@Table({ tableName: "ScamDomains" })
export class ScamDomain extends Model<
	InferAttributes<ScamDomain>,
	InferCreationAttributes<ScamDomain>
> {
	@Attribute(DataTypes.STRING(255))
	@PrimaryKey
	public declare domain: string;

	@Attribute(DataTypes.STRING(20))
	@NotNull
	public declare category: ScamDomainCategory;

	@Attribute(RealBigInt)
	@NotNull
	public declare addedBy: bigint;

	@Attribute(DataTypes.DATE)
	@Default(DataTypes.NOW)
	public declare createdAt: CreationOptional<Date>;
}
