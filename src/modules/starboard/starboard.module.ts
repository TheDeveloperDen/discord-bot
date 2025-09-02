import type Module from "../module.js";
import { StarboardListener } from "./starboard.listener.js";

export const StarboardModule: Module = {
	name: "starboard",
	listeners: [StarboardListener],
};
