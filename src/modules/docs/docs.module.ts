import * as schedule from "node-schedule";
import { runObserved } from "../../observe.js";
import type Module from "../module.js";

import { createDocsCommand } from "./docs.command.js";
import { DocsService } from "./docs.service.js";

const docsService = new DocsService();

export const DocsModule: Module = {
	name: "docs",
	commands: [createDocsCommand(docsService)],
	async preInit() {
		await docsService.initialize();
	},
	async onInit() {
		schedule.scheduleJob("0 */12 * * *", () =>
			runObserved({ op: "event", name: "docs.refresh" }, async () => {
				await docsService.refresh();
			}),
		);
		void runObserved({ op: "event", name: "docs.refresh" }, async () => {
			await docsService.refresh();
		});
	},
};
