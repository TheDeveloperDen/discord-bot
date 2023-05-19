import { Client, ClientEvents, Snowflake } from 'discord.js'
import Module from './module.js'
import { CommandManager } from 'djs-slash-helper'
import { logger } from '../logging.js'
import * as Sentry from '@sentry/node'

export default class ModuleManager {
  private readonly commandManager: CommandManager
  private readonly originalEmit

  constructor (
    private readonly client: Client,
    private readonly clientId: Snowflake,
    private readonly guildId: Snowflake,
    private readonly modules: Module[]
  ) {
    this.originalEmit = this.client.emit
    client.emit = this.overrideEmit().bind(client)
    for (const module of modules) {
      (module.preInit?.(client))?.catch((e) => {
        Sentry.captureException(e)
        logger.error(`Error in preInit for module ${module.name}`, e)
      })
    }
    this.commandManager = new CommandManager(
      modules.flatMap((it) => it.commands ?? []),
      client
    )
  }

  /**
   * Creates a function, intended to replace `EventEmitter#emit`,
   * allowing for us to dynamically dispatch events
   */
  overrideEmit () {
    const modules = this.modules
    const previousEmit = this.originalEmit

    return function emit<K extends keyof ClientEvents> (
      this: Client,
      event: K,
      ...args: ClientEvents[K]
    ) {
      for (const module of modules) {
        if (module.listeners == null) continue
        for (const listener of module.listeners) {
          (listener)[event]?.(this, ...args)
        }
      }
      return previousEmit.call(this, event, ...args)
    }
  }

  async refreshCommands () {
    await this.commandManager.setupForGuild(this.clientId, this.guildId)
  }

  getModules () {
    return this.modules
  }
}
