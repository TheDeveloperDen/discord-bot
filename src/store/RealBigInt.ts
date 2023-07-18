import { DataTypes, ValidationErrorItem } from '@sequelize/core'

export class RealBigInt extends DataTypes.ABSTRACT<BigInt> {
  toSql () {
    return 'BIGINT'
  }

  sanitize (value: unknown): unknown {
    if (value instanceof BigInt || typeof value === 'bigint') {
      return value
    }

    if (typeof value === 'string') {
      return BigInt(value)
    }

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    throw new ValidationErrorItem('Invalid BigInt: ' + value.toString())
  }

  validate (value: unknown): void {
    if (!(value instanceof BigInt || typeof value === 'bigint')) {
      ValidationErrorItem.throwDataTypeValidationError('Value must be a BigInt object')
    }
  }

  parseDatabaseValue (value: unknown) {
    if (typeof value === 'bigint') return value
    if (typeof value === 'string') return BigInt(value)
    if (typeof value === 'number') return BigInt(value)
    if (typeof value === 'boolean') return BigInt(value)

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    throw new Error('Invalid BigInt: ' + value.toString() + ' (' + typeof value + ')')
  }
}
