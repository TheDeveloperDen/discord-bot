import {Command, ExecutableSubcommand} from 'djs-slash-helper'
import {ApplicationCommandOptionType, ApplicationCommandType, PermissionFlagsBits} from 'discord-api-types/v10'
import {getAllCachedResources, getResource, updateAllResources} from './resourcesCache.util.js'
import {Client, GuildMember, User} from 'discord.js'
import {createStandardEmbed, standardFooter} from '../../util/embeds.js'
import {pseudoMention} from '../../util/users.js'
import {moduleManager} from '../../index.js'
import {getEmoji, stringifyEmoji} from '../../util/emojis.js'
import {logger} from '../../logging.js'
import {LearningResource} from './learningResource.model.js'


const resources: { name: string, value: string }[] = []

async function updateResources() {
	await updateAllResources()
	const result = getAllCachedResources().map(it => ({name: it.name, value: it.name}))
	resources.length = 0
	resources.push(...result)
}


const extraFooter = '\n\n[Contribute to our resource collection](https://github.com/TheDeveloperDen/LearningResources)'


export function getResourceEmbed(client: Client, resource: LearningResource, user?: User, member?: GuildMember) {
	const embed = createStandardEmbed(member)
		.setTitle(resource.name)
		.setDescription(`**${resource.description}**\n` +
			resource.resources
				.map(res => {
					const pros = res.pros.length == 0 ? '' : '\n**Pros**\n' + res.pros.map(i => '• ' + i).join('\n')
					const cons = res.cons.length == 0 ? '' : '\n**Cons**\n' + res.cons.map(i => '• ' + i).join('\n')
					const linkedName = `[${res.name}](${res.url})`
					const price = res.price ? `${res.price}` : 'Free!'
					return `${linkedName} - ${price}${pros}${cons}\n`
				}).join('\n')
			+ extraFooter)

	if (user || member) {
		embed.setFooter({
			...standardFooter(),
			text: `Requested by ${pseudoMention((user ?? member?.user)!)} | Learning Resources`
		})
	}

	if (resource.emoji) {
		const emoji = getEmoji(client, resource.emoji)

		if (!emoji) {
			logger.warn(`Could not find emoji ${resource.emoji} for resource ${resource.name}`)
		} else {
			embed.setTitle(`${stringifyEmoji(emoji)} ${resource.name}`)
		}
	}
	return embed
}

const LearningGetSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: 'get',
	description: 'Get a learning resource',
	options: [{
		type: ApplicationCommandOptionType.String,
		name: 'resource',
		description: 'The resource to lookup',
		choices: resources,
		required: true
	}],
	async handle(interaction) {
		const name = interaction.options.get('resource')?.value as string | null
		if (!name) return
		const resource = await getResource(name)
		if (!resource) return interaction.reply(`Could not find resource ${name}`)

		const embed = getResourceEmbed(interaction.client, resource, interaction.user, interaction.member as GuildMember ?? undefined,)
		await interaction.reply({embeds: [embed]})
	}
}

const LearningUpdateSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: 'update',
	description: 'Update the learning resources cache',
	async handle(interaction) {
		const member = interaction.member as GuildMember
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({
			ephemeral: true,
			content: 'No permission'
		})

		await interaction.deferReply({ephemeral: true})
		await updateResources()
		await moduleManager.refreshCommands()
		await interaction.followUp('Updated learning resources cache')
		return
	}
}

const LearningListSubcommand: ExecutableSubcommand = {
	type: ApplicationCommandOptionType.Subcommand,
	name: 'list',
	description: 'List all learning resources',
	options: [],

	async handle(interaction) {
		const resources = getAllCachedResources().map(i => i.name).join(', ')
		const embed = createStandardEmbed(interaction.member as GuildMember ?? undefined)
			.setTitle('Resource List')
			.setDescription(resources + extraFooter)
			.setFooter({
				...standardFooter(),
				text: `Requested by ${pseudoMention(interaction.user)} | Learning Resources`
			})

		await interaction.reply({ephemeral: true, embeds: [embed]})
	}
}

export const LearningCommand: Command<ApplicationCommandType.ChatInput> = {
	type: ApplicationCommandType.ChatInput,
	name: 'learning',
	description: 'Manage learning resources',
	options: [LearningListSubcommand, LearningGetSubcommand, LearningUpdateSubcommand],
	handle() {
	}
}
