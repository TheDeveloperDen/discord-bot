import {Command, commandInfo} from '../commands/Commands.js'
import {logger} from '../logging.js'
import {MarkedClient} from '../MarkedClient.js'
import {PasteCommand} from '../commands/PasteCommand.js'
import {XPCommand} from '../commands/XPCommand.js'
import {RoleCommand} from '../commands/RoleCommand.js'
import {SetCommand} from '../commands/SetCommand.js'
import {InfoCommand} from '../commands/InfoCommand.js'
import {HotTakeCommand} from '../commands/HotTakeCommand.js'
import {ColourRoleCommand} from '../commands/ColourRoleCommand.js'
import {TimeoutCommand} from '../commands/TimeoutCommand.js'
import {PastifyCommand} from '../commands/PastifyCommand.js'
import {REST} from '@discordjs/rest'
import {Routes} from 'discord-api-types/v9'
import {config} from '../Config.js'
import {LeaderboardCommand} from '../commands/LeaderboardCommand.js'
import {DailyRewardCommand} from '../commands/DailyRewardCommand.js'
import {MessageContextMenuInteraction} from 'discord.js'
import {FAQCommand} from '../commands/FAQCommand.js'
import {LearningCommand} from '../commands/LearningCommand.js'

export const commands = [PasteCommand, XPCommand, RoleCommand, SetCommand, InfoCommand, HotTakeCommand,
	ColourRoleCommand, TimeoutCommand, PastifyCommand, LeaderboardCommand,
	DailyRewardCommand, FAQCommand, LearningCommand]

const rest = new REST({version: '10'}).setToken(process.env.BOT_TOKEN ?? '')

export async function init(client: MarkedClient) {
	if (process.env.UPDATE_COMMANDS) {
		logger.info('Registering interactions')
		await update(client, commands)
		logger.info('Registered interactions')
	}

	const guild = await client.guilds.fetch(config.guildId)
	await guild.commands.fetch()
	await Promise.all(commands.map(async command => {
		const info = await commandInfo(command)
		const slash = guild.commands.cache.find(cmd => cmd.name == info.name)
		if (!slash) {
			logger.error(`Command ${info.name} not found in guild ${config.guildId}`)
			return
		}
		client.commands.set(info.name, command)
		logger.info(`Loaded command: ${info.name}`)
	}))
}

export async function update(client: MarkedClient, command: (Command | Command<MessageContextMenuInteraction>)[]) {
	const info = await Promise.all(command.map(
		async cmd => await commandInfo(cmd)
	))
	await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
		body: info.map(i => i.toJSON())
	})
}

export function handle(client: MarkedClient) {
	client.on('interactionCreate', async interaction => {
		if (!interaction.isCommand() && !interaction.isMessageContextMenu()) return
		const command = client.commands.get(interaction.commandName) as Command<typeof interaction>
		if (!command) return
		try {
			await command.execute(interaction)
		} catch (e) {
			logger.error(e)
			await interaction.reply('There was an internal error')
		}
	})
}
