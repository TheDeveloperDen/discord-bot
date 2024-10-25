import {config} from '../../Config.js'
import {Command} from 'djs-slash-helper'
import {GuildMember, Role} from 'discord.js'
import {ApplicationCommandOptionType, ApplicationCommandType} from 'discord-api-types/v10'
import * as Sentry from '@sentry/node'

const allowedRoles = [
    ...config.roles.usersAllowedToSet,
    config.roles.noPing
]

export const RoleCommand: Command<ApplicationCommandType.ChatInput> = {
    name: 'role',
    description: 'Get or remove a role',
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            type: ApplicationCommandOptionType.Role,
            name: 'role',
            description: 'The role to get',
            required: true
        }
    ],

    handle: async (interaction) => await Sentry.startSpan(
        {name: 'RoleCommand#handle'},
        async () => {
            const role = interaction.options.get('role', true).role as Role
            if (!allowedRoles.includes(role.id)) {
                return await interaction.reply(
                    `You cannot get or remove this Role. Options: ${
                        allowedRoles.map(
                            (r) => `<@&${r}>`
                        ).join(', ')
                    }`
                )
            }

            const user = interaction.member as GuildMember
            if (user == null) {
                return await interaction.reply(
                    'You must be a member of this server to use this command.'
                )
            }
            if (user.roles.cache.has(role.id)) {
                await user.roles.remove(role.id)
                await interaction.reply(`Removed role <@&${role.id}>`)
            } else {
                await user.roles.add(role.id)
                await interaction.reply(`Added role <@&${role.id}>`)
            }
        })
}
