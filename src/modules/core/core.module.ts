import type Module from "../module.js";
import { BumpListener } from "./bump.listener.js";
import InfoCommand from "./info.command.js";
import { IntroListener } from "./introduction.listener.js";
import { PollListener } from "./poll.listener.js";
import SetCommand from "./set.command.js";
import TimeoutCommand from "./timeout.command.js";

export const CoreModule: Module = {
	name: "core",
	commands: [InfoCommand, TimeoutCommand, SetCommand],
	listeners: [PollListener, BumpListener, IntroListener],
};
