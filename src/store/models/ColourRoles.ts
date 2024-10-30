import {InferAttributes, InferCreationAttributes, Model} from '@sequelize/core'
import {Attribute, ColumnName, NotNull, PrimaryKey, Table} from '@sequelize/core/decorators-legacy'
import {RealBigInt} from '../RealBigInt.js'

@Table({
    tableName: 'RoleColours'
})
export class ColourRoles extends Model<InferAttributes<ColourRoles>, InferCreationAttributes<ColourRoles>> {
    @Attribute(RealBigInt)
    @PrimaryKey
    @NotNull
    declare public id: bigint

    @Attribute(RealBigInt)
    @NotNull
    @ColumnName('colourRole')
    public role!: bigint
}
