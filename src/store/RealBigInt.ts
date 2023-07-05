import { DataType, Utils } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

class REAL_BIGINT_CLASS extends (Sequelize as any).DataTypes.ABSTRACT {
  static key = 'REAL_BIGINT'
  key = 'REAL_BIGINT'

  static parse (value: string) {
    return BigInt(value)
  }

  static validate (value: unknown) {
    return typeof value === 'bigint'
  }

  toSql () { return 'BIGINT(20) UNSIGNED' }

  _stringify = (value: bigint | null) => value ? String(value) : null

  _sanitize = (value: string | null) => value ? BigInt(value) : null
}

export const REAL_BIGINT = (Utils.classToInvokable(
  REAL_BIGINT_CLASS
) as any) as DataType;

(Sequelize as any).DataTypes.REAL_BIGINT = Utils.classToInvokable(
  REAL_BIGINT_CLASS
)
