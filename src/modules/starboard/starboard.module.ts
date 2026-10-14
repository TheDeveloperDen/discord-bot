import type Module from "../module.js";
import { refreshBoards, StarboardListener } from "./starboard.listener.js";

export const StarboardModule: Module = {
	name: "starboard",
	listeners: [StarboardListener],
	async onInit(_, client) {
		// run in the background as this can take a while
		void refreshBoards(client);
	},
};
