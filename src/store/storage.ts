import {logger} from '../logging.js'
import {DDUser} from './models/DDUser.js'
import {ColourRoles} from './models/ColourRoles.js'
import {FAQ} from './models/FAQ.js'
import {Sequelize} from '@sequelize/core'
import type {PersistedSequelizeOptions} from "@sequelize/core/_non-semver-use-at-your-own-risk_/sequelize.internals.js";
import {DialectName} from "@sequelize/core/_non-semver-use-at-your-own-risk_/sequelize.js";

function sequelizeLog(sql: string, timing?: number) {
    if (timing) {
        if (timing >= 100) {
            logger.warn(`Slow query (${timing}ms): ${sql}`)
        }
    } else {
        logger.debug(sql)
    }
}

export async function initStorage() {
    const database = process.env.DDB_DATABASE ?? 'database'
    const username = process.env.DDB_USERNAME ?? 'root'
    const password = process.env.DDB_PASSWORD ?? 'password'
    const host = process.env.DDB_HOST ?? 'localhost'
    const port = process.env.DDB_PORT ?? '3306'
    const dialect = process.env.DDB_DIALECT ?? 'postgres'

    const commonSequelizeSettings: PersistedSequelizeOptions<any> = {
        logging: sequelizeLog,
        logQueryParameters: true,
        benchmark: true,
    }

    let sequelize: Sequelize

    if (process.env.DDB_HOST) {
        sequelize = new Sequelize({
            database,
            username,
            password,
            host,
            dialect: dialect as DialectName,
            port: parseInt(port),
            ...commonSequelizeSettings
        })
    } else {

        sequelize = new Sequelize({
            dialect: 'sqlite3',
            storage: ':memory:',
            pool: {
                idle: Infinity,
                max: 1
            },
            ...commonSequelizeSettings
        })
    }
    await sequelize.authenticate()

    const models = [DDUser, ColourRoles, FAQ]
    sequelize.addModels(models)

    for (const model of models) {
        await model.sync()
    }
    logger.info('Initialised database')
}
