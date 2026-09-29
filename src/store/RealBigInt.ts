This one has a few real Sequelize API misuse bugs + BigInt handling issues that can break at runtime.

Here is a fully fixed, modern, safe version followed by what was wrong.

✅ FIXED VERSION

import { DataTypes, ValidationErrorItem } from "@sequelize/core";

/**
 * BigInt type that supports:
 * - native bigint (Postgres, etc.)
 * - string fallback (SQLite, MySQL edge cases)
 */
export class RealBigInt extends DataTypes.ABSTRACT<bigint> {
	override toSql() {
		return this.nativeBigIntSupport() ? "BIGINT" : "TEXT";
	}

	nativeBigIntSupport() {
		return Boolean(this._getDialect()?.supports?.dataTypes?.BIGINT);
	}

	override toBindableValue(value: bigint): unknown {
		if (typeof value !== "bigint") {
			throw new TypeError("RealBigInt expects a bigint");
		}

		if (this.nativeBigIntSupport()) {
			return value;
		}

		// fallback encoding
		return `${value}n`;
	}

	override escape(value: unknown): string {
		if (value === null || value === undefined) {
			return "NULL";
		}

		if (typeof value === "bigint") {
			return this.nativeBigIntSupport()
				? value.toString()
				: `'${value}n'`;
		}

		if (typeof value === "string") {
			return `'${value.replace(/'/g, "''")}'`;
		}

		return `'${String(value)}'`;
	}

	override sanitize(value: unknown): bigint {
		if (typeof value === "bigint") return value;

		if (typeof value === "string") {
			const cleaned = value.endsWith("n") ? value.slice(0, -1) : value;
			return BigInt(cleaned);
		}

		if (typeof value === "number") {
			return BigInt(value);
		}

		throw new ValidationErrorItem(
			"Invalid BigInt value",
			"DATATYPE",
			undefined,
			value,
		);
	}

	override validate(value: unknown): void {
		if (typeof value !== "bigint") {
			throw ValidationErrorItem.from({
				message: "Value must be a BigInt",
				type: "DATATYPE",
				value,
			});
		}
	}

	override parseDatabaseValue(value: unknown): bigint {
		if (typeof value === "bigint") return value;

		if (typeof value === "string") {
			const cleaned = value.endsWith("n") ? value.slice(0, -1) : value;
			return BigInt(cleaned);
		}

		if (typeof value === "number") {
			return BigInt(value);
		}

		if (typeof value === "boolean") {
			return BigInt(value ? 1 : 0);
		}

		throw new TypeError(
			`Invalid BigInt database value: ${String(value)} (${typeof value})`,
		);
	}
}
