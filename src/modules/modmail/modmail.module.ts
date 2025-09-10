import type Module from "../module.js";
import { ModmailCommand } from "./modmail.command.js";
import { ModMailListener } from "./modmail.listener.js";

export const ModmailModule: Module = {
	name: "modMail",
	globalCommands: [ModmailCommand],
	listeners: [...ModMailListener],
};
