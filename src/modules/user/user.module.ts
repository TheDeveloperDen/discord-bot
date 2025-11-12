import type Module from "../module.js";
import { ProfileCommand } from "./profileCommand.js";

export const UserModule: Module = {
	name: "user",
	commands: [ProfileCommand],
};
