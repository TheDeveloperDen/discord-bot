/**
 * Achievements Module
 *
 * Provides achievement tracking and display for users.
 */

import type Module from "../module.js";
import { AchievementsCommand } from "./achievements.command.js";
import { GrantAchievementCommand } from "./grantAchievement.command.js";

export const AchievementsModule: Module = {
	name: "achievements",
	commands: [AchievementsCommand, GrantAchievementCommand],
	listeners: [],
};
