import type Module from "../module.js";
import { InformationMessageCommand } from "./informationMessage.command.js";
import { InformationComponents } from "./informationMessage.components.js";

export const InformationModule: Module = {
	name: "information",
	commands: [InformationMessageCommand],
	components: InformationComponents,
};
