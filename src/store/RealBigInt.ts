import { DataTypes, ValidationErrorItem } from "@sequelize/core";

/**
 * A better bigint type than the one Sequelize provides
 * It uses a native bigint where supported, otherwise it converts it to a string adding the suffix "n" to prevent
 * the driver parsing as a number
 */
export class RealBigInt extends DataTypes.ABSTRACT<bigint> {
	toSql() {
		if (this.nativeBigIntSupport()) {
			return "BIGINT";
		} else {
			return "STRING";
		}
	}

	nativeBigIntSupport() {
		return this._getDialect().supports.dataTypes.BIGINT;
	}

	override toBindableValue(value: bigint): unknown {
		console.debug(`toBindableValue: ${value}`);
		if (this.nativeBigIntSupport()) {
			return value;
		} else {
			return `${value.toString()}n`;
		}
	}

	override escape(value: unknown): string {
		if (this.nativeBigIntSupport()) {
			// For native bigint support, return the value as string
			return value?.toString() ?? "0";
		} else {
			if (typeof value === "string") {
				return value.toString();
			}
			// For string representation, escape as a string literal
			return `'${value}n'`;
		}
	}

	override sanitize(value: unknown): unknown {
		if (value instanceof BigInt || typeof value === "bigint") {
			return value;
		}

		if (typeof value === "string") {
			return BigInt(value);
		}

		throw new ValidationErrorItem("Invalid BigInt", "DATATYPE");
	}

	override validate(value: unknown): void {
		if (!(value instanceof BigInt || typeof value === "bigint")) {
			ValidationErrorItem.throwDataTypeValidationError(
				"Value must be a BigInt object",
			);
		}
	}

	override parseDatabaseValue(value: unknown) {
		if (typeof value === "bigint") return value;
		if (typeof value === "string") {
			// stupid lol
			if (value.endsWith("n")) {
				return BigInt(value.slice(0, -1));
			}
			return BigInt(value);
		}
		if (typeof value === "number") return BigInt(value);
		if (typeof value === "boolean") return BigInt(value);

		throw new Error(
			"Invalid BigInt: " +
				(value as object).toString() +
				" (" +
				typeof value +
				")",
		);
	}
}
