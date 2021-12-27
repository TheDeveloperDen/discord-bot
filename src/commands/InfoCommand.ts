import {SlashCommandBuilder} from '@discordjs/builders'
import {CommandInteraction, GuildMember} from 'discord.js'
import {Command} from './Commands.js'
import {createStandardEmbed} from '../util/embeds.js'
import {DDUser} from '../store/models/DDUser.js'
import {SavedMessage} from '../store/models/SavedMessage.js'

export class InfoCommand implements Command {
	info = new SlashCommandBuilder()
		.setName('info')
		.setDescription('Show information about the bot and server')


	async execute(interaction: CommandInteraction) {
		await interaction.deferReply()
		const guild = interaction.guild
		if (!guild) {
			await interaction.reply('This command can only be used in a server')
			return
		}
		const totalXP = await DDUser.sum('xp')
		const memberCount = guild.memberCount
		const membersStored = await DDUser.count()
		const dateCreated = `
            <t:${guild.createdAt.getTime() / 1000 | 0}>`
		const levelUps = await DDUser.sum('level')
		const messageCount = await SavedMessage.count()
		await interaction.followUp({
			embeds: [{
				...createStandardEmbed(interaction.member as GuildMember),
				title: 'Developer Den',
				description: 'This is the bot for the Developer Den server. It\'s written in **TypeScript** using the **Discord.js** library.' +
					'The source can be found [here](https://github.com/TheDeveloperDen/DevDenBot)',
				fields: [
					{
						name: 'Version',
						value: format(process.env.npm_package_version), inline: true
					},
					{
						name: 'Total XP',
						value: format(totalXP), inline: true
					},
					{
						name: 'Member Count',
						value: format(memberCount), inline: true
					},
					{
						name: 'Members Stored',
						value: format(membersStored), inline: true
					},
					{
						name: 'Level Ups',
						value: format(levelUps), inline: true
					},
					{
						name: 'Messages Stored',
						value: format(messageCount), inline: true
					},
					{
						name: 'Date Created',
						value: dateCreated, inline: true
					}
				]
			}]
		})
	}
}

const format = (val: string | number | undefined) => {
	if (typeof val === 'number') {
		return `\`${val.toLocaleString()}\``
	} else {
		return `\`${val}\``
	}
}