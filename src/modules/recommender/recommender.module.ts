import type Module from "../module.js";
import { WhatLangCommand } from "./recommender.command.js";
import {
	RecommenderListener,
	startSessionCleanup,
} from "./recommender.listener.js";

export const RecommenderModule: Module = {
	name: "recommender",
	commands: [WhatLangCommand],
	listeners: [RecommenderListener],
	async onInit() {
		startSessionCleanup();
	},
};
