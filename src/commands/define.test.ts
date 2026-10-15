import { describe, expect, mock, test } from "bun:test";
import {
	ApplicationCommandOptionType,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	type GuildMember,
	type UserContextMenuCommandInteraction,
} from "discord.js";
import type { ExecutableSubcommand } from "./command.js";
import { defineCommand, defineContextMenu, subcommand } from "./define.js";
import * as option from "./options.js";

/** A chat input interaction with just enough of discord.js's API for the command layer */
function fakeInteraction(
	values: Record<string, Record<string, unknown>>,
	{ cached = true } = {},
) {
	const reply = mock(async (_: unknown) => {});
	const interaction = {
		inCachedGuild: () => cached,
		options: { get: (name: string) => values[name] ?? null },
		reply,
	} as unknown as ChatInputCommandInteraction;
	return { interaction, reply };
}

const member = { id: "member" } as GuildMember;

describe("defineCommand", () => {
	test("registers the options in declaration order with only the fields that were set", () => {
		const command = defineCommand({
			name: "test",
			description: "d",
			options: {
				target: option.member({ description: "who", required: true }),
				name: option.string({
					description: "n",
					max_length: 64,
					autocomplete: () => [],
				}),
			},
			handle() {},
		});
		expect(JSON.parse(JSON.stringify(command))).toEqual({
			type: 1,
			name: "test",
			description: "d",
			options: [
				{
					type: ApplicationCommandOptionType.User,
					name: "target",
					description: "who",
					required: true,
				},
				{
					type: ApplicationCommandOptionType.String,
					name: "name",
					description: "n",
					max_length: 64,
					autocomplete: true,
				},
			],
		});
	});

	test("rejects a required option after an optional one", () => {
		expect(() =>
			defineCommand({
				name: "test",
				description: "d",
				options: {
					first: option.string({ description: "d" }),
					second: option.string({ description: "d", required: true }),
				},
				handle() {},
			}),
		).toThrow(/must come before/);
	});

	test("passes parsed options to the handler", async () => {
		const handle = mock(() => {});
		const command = defineCommand({
			name: "test",
			description: "d",
			options: {
				target: option.member({ description: "d", required: true }),
				count: option.integer({ description: "d" }),
				missing: option.string({ description: "d" }),
			},
			handle,
		});
		const { interaction } = fakeInteraction({
			target: { member },
			count: { value: 3 },
		});
		await command.handle(interaction);
		expect(handle).toHaveBeenCalledWith(interaction, {
			target: member,
			count: 3,
		});
	});

	test("refuses a member who has left instead of running", async () => {
		const handle = mock(() => {});
		const command = defineCommand({
			name: "test",
			description: "d",
			options: { target: option.member({ description: "d" }) },
			handle,
		});
		const { interaction, reply } = fakeInteraction({
			target: { user: {}, member: null },
		});
		await command.handle(interaction);
		expect(handle).not.toHaveBeenCalled();
		expect(reply).toHaveBeenCalledTimes(1);
	});

	test("refuses outside a cached guild unless guildOnly is false", async () => {
		const guildOnly = mock(() => {});
		const anywhere = mock(() => {});
		const { interaction, reply } = fakeInteraction({}, { cached: false });

		await defineCommand({
			name: "a",
			description: "d",
			handle: guildOnly,
		}).handle(interaction);
		await defineCommand({
			name: "b",
			description: "d",
			guildOnly: false,
			handle: anywhere,
		}).handle(interaction);

		expect(guildOnly).not.toHaveBeenCalled();
		expect(reply).toHaveBeenCalledTimes(1);
		expect(anywhere).toHaveBeenCalledTimes(1);
	});

	test("compiles subcommands and groups without a dummy handler", () => {
		const sub = subcommand({ description: "s", handle() {} });
		const command = defineCommand({
			name: "test",
			description: "d",
			subcommands: { get: sub },
			groups: { config: { description: "g", subcommands: { set: sub } } },
		});
		expect(JSON.parse(JSON.stringify(command)).options).toEqual([
			{ type: 1, name: "get", description: "s", options: [] },
			{
				type: 2,
				name: "config",
				description: "g",
				options: [{ type: 1, name: "set", description: "s", options: [] }],
			},
		]);
	});

	test("answers autocomplete from the focused option", async () => {
		const command = defineCommand({
			name: "test",
			description: "d",
			subcommands: {
				get: subcommand({
					description: "d",
					options: {
						name: option.string({
							description: "d",
							required: true,
							autocomplete: (typed) => [
								{ name: "apple", value: "apple" },
								{ name: typed, value: typed },
							],
						}),
					},
					handle() {},
				}),
			},
		});
		const respond = mock(async (_: unknown) => {});
		const interaction = {
			inCachedGuild: () => true,
			options: {
				getFocused: (full?: boolean) =>
					full ? { name: "name", value: "ban" } : "ban",
			},
			respond,
		} as unknown as AutocompleteInteraction;

		const [get] = command.options as [ExecutableSubcommand];
		await get.autocomplete?.(interaction);
		expect(respond).toHaveBeenCalledWith([{ name: "ban", value: "ban" }]);
	});

	test("types options from their declarations", () => {
		defineCommand({
			name: "test",
			description: "d",
			options: {
				target: option.member({ description: "d", required: true }),
				reason: option.string({ description: "d" }),
				kind: option.string({
					description: "d",
					choices: [
						{ name: "A", value: "a" },
						{ name: "B", value: "b" },
					],
				}),
			},
			handle(interaction, { target, reason, kind }) {
				const member: GuildMember = target;
				const guildMember: GuildMember = interaction.member;
				// @ts-expect-error optional options may be undefined
				const text: string = reason;
				const choice: "a" | "b" | undefined = kind;
				// @ts-expect-error not narrowed to one choice (guards against `any`)
				const one: "a" | undefined = kind;
				return [member, guildMember, text, choice, one];
			},
		});
		subcommand({
			description: "d",
			options: {
				size: option.integer({
					description: "d",
					required: true,
					choices: [
						{ name: "S", value: 1 },
						{ name: "L", value: 2 },
					],
				}),
			},
			handle(_, { size }) {
				const value: 1 | 2 = size;
				// @ts-expect-error not narrowed to one choice (guards against `any`)
				const one: 1 = size;
				return [value, one];
			},
		});
		defineCommand({
			name: "test",
			description: "d",
			options: { reason: option.string({ description: "d" }) },
			// @ts-expect-error not a declared option
			handle(_, { nope }) {
				return nope;
			},
		});
		defineCommand({
			name: "test",
			description: "d",
			guildOnly: false,
			handle(interaction) {
				// @ts-expect-error the member isn't resolved outside a cached guild
				const member: GuildMember = interaction.member;
				return member;
			},
		});
	});
});

describe("defineContextMenu", () => {
	test("resolves the target member for user commands", async () => {
		const handle = mock((_interaction: unknown, _target: GuildMember) => {});
		const command = defineContextMenu({
			type: "user",
			name: "Test",
			handle,
		});
		const reply = mock(async (_: unknown) => {});
		const base = {
			inCachedGuild: () => true,
			isUserContextMenuCommand: () => true,
			reply,
		};

		await command.handle({
			...base,
			targetMember: member,
		} as unknown as UserContextMenuCommandInteraction);
		await command.handle({
			...base,
			targetMember: null,
		} as unknown as UserContextMenuCommandInteraction);

		expect(handle).toHaveBeenCalledTimes(1);
		expect(handle.mock.calls[0]).toEqual([expect.anything(), member]);
		expect(reply).toHaveBeenCalledTimes(1);
	});
});
