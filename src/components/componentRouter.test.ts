import { describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { Client, Interaction } from "discord.js";
import { defineComponent, parseCustomId } from "./component.js";
import { ComponentRouter } from "./componentRouter.js";

const Plain = defineComponent({
	id: "test:plain",
	kind: "button",
	handle() {},
});
const TwoArgs = defineComponent({
	id: "test:two",
	kind: "button",
	args: ["first", "rest"],
	handle() {},
});

describe("parseCustomId", () => {
	test.each([
		["test:plain", Plain, {}],
		["test:plain:extra", Plain, undefined],
		["test:plainer", Plain, undefined],
		["test:two:a:b:c", TwoArgs, { first: "a", rest: "b:c" }],
		["test:two:a", TwoArgs, undefined],
		["test:two", TwoArgs, undefined],
	] as const)("%p", (id, component, expected) => {
		expect(parseCustomId(component, id)).toEqual(expected);
	});
});

function fakeInteraction(kind: "button" | "modal", id: string) {
	return {
		customId: id,
		isButton: () => kind === "button",
		isStringSelectMenu: () => false,
		isModalSubmit: () => kind === "modal",
		isRepliable: () => false,
		user: { id: "1", tag: "user" },
		guildId: "2",
		channelId: "3",
	} as unknown as Interaction;
}

describe("ComponentRouter", () => {
	function setup() {
		const handle = mock(() => {});
		const component = defineComponent({
			id: "test:route",
			kind: "button",
			args: ["ticketId"],
			handle,
		});
		const client = new EventEmitter();
		new ComponentRouter([component], client as unknown as Client);
		const emit = async (interaction: Interaction) => {
			client.emit("interactionCreate", interaction);
			await Bun.sleep(0);
		};
		return { handle, emit };
	}

	test("dispatches to the owning component with parsed args", async () => {
		const { handle, emit } = setup();
		const interaction = fakeInteraction("button", "test:route:42");
		await emit(interaction);
		expect(handle).toHaveBeenCalledWith(interaction, { ticketId: "42" });
	});

	test("ignores unknown ids and the wrong kind", async () => {
		const { handle, emit } = setup();
		await emit(fakeInteraction("button", "something-else"));
		await emit(fakeInteraction("modal", "test:route:42"));
		expect(handle).not.toHaveBeenCalled();
	});

	test("rejects overlapping ids", () => {
		const client = new EventEmitter() as unknown as Client;
		const a = defineComponent({ id: "a", kind: "button", handle() {} });
		const b = defineComponent({ id: "a:b", kind: "modal", handle() {} });
		expect(() => new ComponentRouter([a, a], client)).toThrow();
		expect(() => new ComponentRouter([a, b], client)).toThrow();
	});
});
