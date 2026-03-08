import type Module from "../module.js";
import { ManageSuggestionCommand } from "./manageSuggestion.command.js";
import { SuggestCommand } from "./suggest.command.js";
import { SuggestionButtonListener } from "./suggest.listener.js";
import { SyncSuggestionVotesCommand } from "./syncSuggestionVotes.command.js";

export const SuggestModule: Module = {
	name: "suggest",
	commands: [
		SuggestCommand,
		ManageSuggestionCommand,
		SyncSuggestionVotesCommand,
	],
	listeners: [SuggestionButtonListener],
};

export default SuggestModule;
