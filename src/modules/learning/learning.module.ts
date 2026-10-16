import type Module from "../module.js";
import {
	LearningCommand,
	LearningListPages,
	ResourcePages,
	updateResourcesForCommands,
} from "./learning.command.js";

export const LearningModule: Module = {
	name: "learning",
	commands: [LearningCommand],
	components: [LearningListPages, ResourcePages],
	preInit: updateResourcesForCommands,
};
