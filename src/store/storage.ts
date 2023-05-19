import { logger } from '../logging.js'
import { DDUser } from './models/DDUser.js'
import { ColourRoles } from './models/ColourRoles.js'
import { FAQ } from './models/FAQ.js'
import { ModelCtor, Sequelize, SequelizeOptions } from 'sequelize-typescript'
import { Dialect, Options } from 'sequelize'

function sequelizeLog (sql: string, timing?: number) {
  logger.info(sql)
  if (timing) {
    if (timing >= 100) {
      logger.warn(`Slow query (${timing}ms): ${sql}`)
    }
  } else {
    logger.debug(sql)
  }
}

export async function initStorage () {
  const database = process.env.DATABASE ?? 'database'
  const username = process.env.USERNAME ?? 'root'
  const password = process.env.PASSWORD ?? 'password'
  const host = process.env.HOST ?? 'localhost'
  const port = process.env.PORT ?? '3306'
  const dialect = process.env.DIALECT ?? 'mariadb'

  const commonSequelizeSettings: SequelizeOptions = {
    logging: sequelizeLog,
    logQueryParameters: true,
    benchmark: true,
    models: []
  }

  let sequelize: Sequelize

  if (process.env.HOST) {
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
    sequelize = new Sequelize('sqlite::memory:', commonSequelizeSettings)
  }

  const models: ModelCtor[] = [DDUser, ColourRoles, FAQ]

  sequelize.addModels(models)

  for (const model of models) {
    await model.sync()
  }
  logger.info('Initialised database')
}
