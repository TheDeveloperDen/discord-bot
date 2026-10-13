import type Module from "../module.js";
import { FaqCommand } from "./faq.command.js";
import { FaqEditModal } from "./faq.modal.js";
import { FaqCommandListener } from "./faqCommand.listener.js";

export const FaqModule: Module = {
	name: "faq",
	commands: [FaqCommand],
	listeners: [FaqCommandListener],
	components: [FaqEditModal],
};

export default FaqModule;
