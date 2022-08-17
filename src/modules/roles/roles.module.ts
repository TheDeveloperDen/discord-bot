import Module from '../module.js'
import {RoleCommand} from './role.command.js'
import {RoleColourCommand} from './roleColour.command.js'
import {RoleColourListener} from './roleColour.listener.js'

export const RolesModule: Module = {
	name: 'roles',
	commands: [RoleCommand, RoleColourCommand],
	listeners: [RoleColourListener]
}
