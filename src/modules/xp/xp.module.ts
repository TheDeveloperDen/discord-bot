import Module from '../module.js'
import {XpCommand} from './xp.command.js'
import {DailyRewardCommand} from './dailyReward.command.js'
import {XpListener} from './xp.listener.js'
import {LeaderboardCommand} from './leaderboard.command.js'
import {ThreadListener} from './threadStuff.listener.js'
import {scheduleAllReminders} from './dailyReward.reminder.js'

export const XpModule: Module = {
	name: 'xp',
	commands: [XpCommand, DailyRewardCommand, LeaderboardCommand],
	listeners: [XpListener, ThreadListener],
	onInit: async (client) => {
		await scheduleAllReminders(client)
	}
}
