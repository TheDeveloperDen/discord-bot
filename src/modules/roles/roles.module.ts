import Module from '../module.js'
import {RoleCommand} from './role.command.js'
import {RoleColourCommand} from './roleColour.command.js'

export const RolesModule: Module = {
	name: 'roles',
	commands: [RoleCommand, RoleColourCommand]
}
