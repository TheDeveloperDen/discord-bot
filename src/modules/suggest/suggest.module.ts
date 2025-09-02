import type Module from "../module.js";
import { SuggestCommand } from "./suggest.command.js";
import { SuggestionButtonListener } from "./suggest.listener.js";

export const SuggestModule: Module = {
	name: "suggest",
	commands: [SuggestCommand],
	listeners: [SuggestionButtonListener],
};

export default SuggestModule;
