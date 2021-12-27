import {Client, Collection, GuildMember, Role} from 'discord.js'

const generalSeparatorRole = '874786063493787658'
const tagsSeparatorRole = '874783773605130280'
const langsSeparatorRole = '874783339981189240'


export type RoleChanges = {
    toAdd: string[],
    toRemove: string[]
}

export const modifyRoles = async (client: Client, user: GuildMember, roleChanges: RoleChanges) => {
	const currentRoles = user.roles.cache.clone()
	const guild = user.guild
	currentRoles.delete(guild.roles.everyone.id)
	const getRole = (roleId: string) => {
		const role = guild.roles.cache.get(roleId)
		if (!role) {
			throw new Error(`Role ${roleId} not found`)
		}
		return role
	}

	const addRole = (roleId: string) => currentRoles.set(roleId, getRole(roleId))
	roleChanges.toAdd.forEach(addRole)
	roleChanges.toRemove.forEach(role => currentRoles.delete(role))

	const langsSeparator = hasRolesBetween(langsSeparatorRole, null)(currentRoles)
	if (langsSeparator) {
		addRole(langsSeparatorRole)
	} else {
		currentRoles.delete(langsSeparatorRole)
	}
	const tagsSeparator = hasRolesBetween(tagsSeparatorRole, langsSeparatorRole)(currentRoles)
	if (tagsSeparator) {
		addRole(tagsSeparatorRole)
	} else {
		currentRoles.delete(tagsSeparatorRole)
	}

	const generalSeparator = hasRolesBetween(null, generalSeparatorRole)(currentRoles)
        && hasRolesBetween(generalSeparatorRole, tagsSeparatorRole)(currentRoles)
	if (generalSeparator) {
		addRole(generalSeparatorRole)
	} else {
		currentRoles.delete(generalSeparatorRole)
	}

	await user.roles.set(currentRoles)
}

const hasRolesBetween = (upperBound: string | null, lowerBound: string | null) => (roles: Collection<string, Role>) => {
	let match = true
	if (upperBound && lowerBound) {
		match &&= roles.some(role => role.comparePositionTo(upperBound) < 0 && role.comparePositionTo(lowerBound) > 0)
	}
	if (upperBound) {
		match &&= roles.some(role => role.comparePositionTo(upperBound) < 0)
	}
	if (lowerBound) {
		match &&= roles.some(role => role.comparePositionTo(lowerBound) > 0)
	}
	return match
}