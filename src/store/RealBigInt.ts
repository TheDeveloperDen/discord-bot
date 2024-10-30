import {DataTypes, ValidationErrorItem} from '@sequelize/core'

export class RealBigInt extends DataTypes.ABSTRACT<bigint> {
    toSql() {
        return 'BIGINT'
        // this is actually kind of bad, as it will use BIGINT on sqlite too, potentially losing data
        // however since sqlite is only used for testing i basically don't care
    }

    sanitize(value: unknown): unknown {
        if (value instanceof BigInt || typeof value === 'bigint') {
            return value
        }

        if (typeof value === 'string') {
            return BigInt(value)
        }

        throw new ValidationErrorItem('Invalid BigInt',
            'DATATYPE',
        )
    }

    validate(value: unknown): void {
        if (!(value instanceof BigInt || typeof value === 'bigint')) {
            ValidationErrorItem.throwDataTypeValidationError('Value must be a BigInt object')
        }
    }

    parseDatabaseValue(value: unknown) {
        if (typeof value === 'bigint') return value
        if (typeof value === 'string') return BigInt(value)
        if (typeof value === 'number') return BigInt(value)
        if (typeof value === 'boolean') return BigInt(value)


        throw new Error('Invalid BigInt: ' + (value as object).toString() + ' (' + typeof value + ')')
    }
}
