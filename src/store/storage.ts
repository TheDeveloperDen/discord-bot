import { logger } from '../logging.js'
import { DDUser } from './models/DDUser.js'
import { ColourRoles } from './models/ColourRoles.js'
import { FAQ } from './models/FAQ.js'
import { Dialect, Options, Sequelize } from '@sequelize/core'

function sequelizeLog (sql: string, timing?: number) {
  if (timing) {
    if (timing >= 100) {
      logger.warn(`Slow query (${timing}ms): ${sql}`)
    }
  } else {
    logger.debug(sql)
  }
}

export async function initStorage () {
  const database = process.env.DDB_DATABASE ?? 'database'
  const username = process.env.DDB_USERNAME ?? 'root'
  const password = process.env.DDB_PASSWORD ?? 'password'
  const host = process.env.DDB_HOST ?? 'localhost'
  const port = process.env.DDB_PORT ?? '3306'
  const dialect = process.env.DDB_DIALECT ?? 'postgres'

  const commonSequelizeSettings: Options = {
    logging: sequelizeLog,
    logQueryParameters: true,
    benchmark: true,
    models: []
  }

  let sequelize: Sequelize

  if (process.env.DDB_HOST) {
    const sequelizeOptions: Options = {
      database,
      username,
      password,
      host,
      dialect: dialect as Dialect,
      port: parseInt(port),
      ...commonSequelizeSettings
    }
    sequelize = new Sequelize(sequelizeOptions)
  } else {
    const sequelizeOptions: Options = {
      dialect: 'sqlite',
      storage: ':memory:',
      ...commonSequelizeSettings
    }
    sequelize = new Sequelize(sequelizeOptions)
  }
  await sequelize.authenticate()

  const models = [DDUser, ColourRoles, FAQ]
  sequelize.addModels(models)

  for (const model of models) {
    await model.sync()
  }
  logger.info('Initialised database')
}
