import Module from '../module.js'
import {LearningCommand} from './learning.command.js'

export const LearningModule: Module = {
	name: 'learning',
	commands: [LearningCommand]
}
