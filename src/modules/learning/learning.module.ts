import type Module from "../module.js";
import {
	LearningCommand,
	updateResourcesForCommands,
} from "./learning.command.js";

export const LearningModule: Module = {
	name: "learning",
	commands: [LearningCommand],
	preInit: updateResourcesForCommands,
};
