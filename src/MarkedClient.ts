import {Client, Collection} from "discord.js";
import {Command} from "./commands/Command";

export type MarkedClient = Client & { commands: Collection<string, Command> }