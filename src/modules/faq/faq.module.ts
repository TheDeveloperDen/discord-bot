import type Module from "../module.js";
import { FaqCommand, updateChoices } from "./faq.command.js";
import { FaqCommandListener } from "./faqCommand.listener.js";

export const FaqModule: Module = {
	name: "faq",
	commands: [FaqCommand],
	listeners: [FaqCommandListener],
	onCommandInit: updateChoices,
	onInit: async (manager) => {
		await manager.refreshCommands();
	},
};

export default FaqModule;
