import Module from '../module.js'
import {XpCommand} from './xp.command.js'
import {DailyRewardCommand} from './dailyReward.command.js'

export const XpModule: Module = {
	name: 'xp',
	commands: [XpCommand, DailyRewardCommand]
}
