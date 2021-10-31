import Sequelize, {Model} from "sequelize";
import {sequelize} from "./storage";

export class DDUser extends Model {
    public id!: number;
    public xp!: number;
    public level!: number;
    public bumps!: number;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

}

export const Users = DDUser.init({
    id: {
        type: new Sequelize.BIGINT({length: 20}),
        primaryKey: true
    },
    xp: new Sequelize.BIGINT({length: 20}),
    level: new Sequelize.INTEGER({length: 11}),
    bumps: new Sequelize.INTEGER({length: 11}),
}, {
    tableName: 'Users',
    sequelize: sequelize
})