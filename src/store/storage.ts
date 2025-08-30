import {
  type AbstractDialect,
  type DialectName,
  Sequelize,
} from "@sequelize/core";
import { SqliteDialect } from "@sequelize/sqlite3";
import type { ConnectionConfig } from "pg";
import { logger } from "../logging.js";
import { Bump } from "./models/Bump.js";
import { ColourRoles } from "./models/ColourRoles.js";
import { DDUser } from "./models/DDUser.js";
import { FAQ } from "./models/FAQ.js";
import { ModeratorActions } from "./models/ModeratorActions.js";
import { StarboardMessage } from "./models/StarboardMessage.js";

function sequelizeLog(sql: string, timing?: number) {
  if (timing) {
    if (timing >= 100) {
      logger.warn(`Slow query (${timing}ms): ${sql}`);
    }
  } else {
    logger.debug(sql);
  }
}

export async function initStorage() {
  const database = process.env.DDB_DATABASE ?? "database";
  const username = process.env.DDB_USERNAME ?? "root";
  const password = process.env.DDB_PASSWORD ?? "password";
  const host = process.env.DDB_HOST ?? "localhost";
  const port = process.env.DDB_PORT ?? "3306";
  const dialect = process.env.DDB_DIALECT ?? "postgres";

  let sequelize: Sequelize;

  if (process.env.DDB_HOST) {
    sequelize = new Sequelize<AbstractDialect<object, ConnectionConfig>>({
      dialect: dialect as DialectName,
      database: database,
      user: username,
      password,
      host,
      port: parseInt(port, 10),
      logging: sequelizeLog,
      benchmark: true,
    });
  } else {
    sequelize = new Sequelize({
      dialect: SqliteDialect,

      storage: ":memory:",
      pool: {
        idle: Infinity,
        max: 1,
      },
      logging: sequelizeLog,
      benchmark: true,
    });
  }
  await sequelize.authenticate();

  const models = [
    DDUser,
    ColourRoles,
    FAQ,
    Bump,
    StarboardMessage,
    ModeratorActions,
  ];
  sequelize.addModels(models);

  Bump.belongsTo(DDUser, {
    foreignKey: "userId",
    as: "user",
  });

  await sequelize.sync();

  sequelizeInstance = sequelize;
  logger.info("Initialised database");
}

let sequelizeInstance: Sequelize;

export const getSequelizeInstance = () => {
  return sequelizeInstance;
};
