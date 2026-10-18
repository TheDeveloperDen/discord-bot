import type Module from "../module.js";
import { RegexCommand, regexComponents } from "./regex.command.js";

export const RegexModule: Module = {
	name: "regex",
	commands: [RegexCommand],
	components: regexComponents,
};

export default RegexModule;
