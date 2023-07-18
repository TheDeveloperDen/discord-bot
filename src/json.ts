import { Transaction } from '@sequelize/core'
// @ts-expect-error: Unreachable code error
// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function (): string {
  return this.toString()
}

// eslint-disable-next-line no-extend-native
// @ts-expect-error
Transaction.prototype.toJSON = function (): string {
  return '<Transaction>' // fixes circular reference
}

export function toJson (val: any): string {
  return JSON.stringify(val)
}
