import {CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model} from '@sequelize/core'

import {Attribute, AutoIncrement, NotNull, PrimaryKey, Table} from '@sequelize/core/decorators-legacy'
import {RealBigInt} from "../RealBigInt.js";

@Table({tableName: 'FAQs'})
export class FAQ extends Model<InferAttributes<FAQ>, InferCreationAttributes<FAQ>> {
    @Attribute(RealBigInt)
    @PrimaryKey
    @AutoIncrement
    declare public id: CreationOptional<bigint>

    @Attribute(RealBigInt)
    @NotNull
    declare public author: bigint

    @Attribute(DataTypes.STRING(64))
    @NotNull
    declare public name: string

    @Attribute(DataTypes.STRING(64))
    @NotNull
    declare public title: string

    @Attribute(DataTypes.TEXT('long'))
    @NotNull
    declare public content: string
}
