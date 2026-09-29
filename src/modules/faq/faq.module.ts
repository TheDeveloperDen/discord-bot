import type Module from "../module.js";
import { FaqCommand, updateChoices } from "./faq.command.js";
import { FaqCommandListener } from "./faqCommand.listener.js";

export const FaqModule: Module = {
	name: "faq",
	commands: [FaqCommand],
	listeners: [FaqCommandListener],
	onCommandInit: updateChoices,
};

export default FaqModule;
