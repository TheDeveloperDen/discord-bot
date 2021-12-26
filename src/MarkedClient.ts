import {Client, Collection} from "discord.js";
import {Command} from "./commands/Commands.js";

export type MarkedClient = Client & { commands: Collection<string, Command> }