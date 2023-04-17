import {Sequelize} from 'sequelize-typescript'
import {logger} from '../logging.js'
import {DDUser} from './models/DDUser.js'
import {ColourRoles} from './models/ColourRoles.js'
import {FAQ} from './models/FAQ.js'

const database = process.env.DATABASE ?? 'database'
const username = process.env.USERNAME ?? 'admin'
const password = process.env.PASSWORD ?? 'password'
const host = process.env.HOST ?? 'localhost'

export const sequelize = new Sequelize({
    database: database,
    username: username,
    password: password,
    models: [],
    host: host,
    dialect: 'mariadb',
    logging: sequelizeLog,
    logQueryParameters: true,
    benchmark: true
})

function sequelizeLog(sql: string, timing?: number) {
    if (timing) {
        if (timing >= 10) {
            logger.warn(`Slow query (${timing}ms): ${sql}`)
        }
    } else {
        logger.debug(sql)
    }
}


let resolve: () => void
export const databaseInit = new Promise<void>(r => resolve = r)

export async function init() {
    const models = [DDUser, ColourRoles, FAQ]
    sequelize.addModels(models)
    for (const model of models) {
        await model.sync()
    }
    resolve()
    logger.info('Initialised database')
}

await init()
