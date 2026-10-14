import { describe, expect, it } from "bun:test";
import {
	ApplicationCommandType,
	type Client,
	Routes,
	type Snowflake,
} from "discord.js";
import type { Command } from "./command.js";
import { CommandManager } from "./commandManager.js";

type PutCall = {
	route: string;
	body: Record<string, unknown>[];
};

const managedCommand: Command<ApplicationCommandType.ChatInput> = {
	type: ApplicationCommandType.ChatInput,
	name: "managed",
	description: "A managed global command",
	options: [],
	handle() {},
};

describe("CommandManager global registration", () => {
	it("retains Discord's primary entry point without restoring removed commands", async () => {
		const putCalls: PutCall[] = [];
		const existingCommands = [
			{
				type: ApplicationCommandType.PrimaryEntryPoint,
				name: "Apps",
				description: "Browse this app's activities",
				handler: 2,
				integration_types: [0],
				contexts: [0, 1, 2],
				default_member_permissions: null,
			},
			{
				type: ApplicationCommandType.ChatInput,
				name: "removed",
				description: "A command no longer managed by the bot",
			},
		];
		const client = {
			on() {},
			rest: {
				async get() {
					return existingCommands;
				},
				async put(route: string, options: { body: Record<string, unknown>[] }) {
					putCalls.push({ route, body: options.body });
				},
			},
		} as unknown as Client;

		const manager = new CommandManager([managedCommand], client);
		const applicationId = "123456789012345678" as Snowflake;
		await manager.setupGlobally(applicationId);

		expect(putCalls).toHaveLength(1);
		expect(putCalls[0]?.route).toBe(Routes.applicationCommands(applicationId));
		expect(putCalls[0]?.body).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: ApplicationCommandType.PrimaryEntryPoint,
					name: "Apps",
					handler: 2,
					integration_types: [0],
					contexts: [0, 1, 2],
				}),
				expect.objectContaining({ name: "managed" }),
			]),
		);
		expect(putCalls[0]?.body).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ name: "removed" })]),
		);
	});
});
