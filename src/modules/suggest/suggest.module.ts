import type Module from "../module.js";
import { ManageSuggestionCommand } from "./manageSuggestion.command.js";
import { SuggestCommand } from "./suggest.command.js";
import { refreshSuggestions } from "./suggest.js";
import {
	SuggestionButtonListener,
	SuggestionComponents,
} from "./suggest.listener.js";

export const SuggestModule: Module = {
	name: "suggest",
	commands: [SuggestCommand, ManageSuggestionCommand],
	listeners: [SuggestionButtonListener],
	components: SuggestionComponents,
	async onInit(_, client) {
		// background as this can take a while
		void refreshSuggestions(client);
	},
};

export default SuggestModule;
