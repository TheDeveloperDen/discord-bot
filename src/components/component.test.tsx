import { describe, expect, test } from "bun:test";
import {
	type ButtonInteraction,
	ButtonStyle,
	type InteractionReplyOptions,
	type MessageCreateOptions,
	type MessageEditOptions,
	TextInputStyle,
} from "discord.js";
import {
	ActionRow,
	Button,
	Label,
	Message,
	Modal,
	renderDiscordMessage,
	renderDiscordModal,
	TextDisplay,
	TextInput,
} from "disjsx";
import { defineComponent } from "./component.js";

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

/** Renders one button and returns its customId */
const customIdOf = (button: React.ReactElement) => {
	const { components } = renderDiscordMessage(
		<Message isV2>
			<ActionRow>{button}</ActionRow>
		</Message>,
	);
	const [row] = components as { components: { custom_id: string }[] }[];
	return row.components[0].custom_id;
};

const style = ButtonStyle.Primary;

describe("component elements", () => {
	test("build their customId from the id and args", () => {
		expect(customIdOf(<Plain style={style}>x</Plain>)).toBe("test:plain");
		expect(
			customIdOf(
				<TwoArgs first="a" rest="b" style={style}>
					x
				</TwoArgs>,
			),
		).toBe("test:two:a:b");
	});

	test("pass their other props through", () => {
		const { components } = renderDiscordMessage(
			<Message isV2>
				<ActionRow>
					<TwoArgs first="a" rest="b" style={ButtonStyle.Danger} disabled>
						Delete
					</TwoArgs>
				</ActionRow>
			</Message>,
		);
		expect(components?.[0]).toMatchObject({
			components: [
				{ style: ButtonStyle.Danger, label: "Delete", disabled: true },
			],
		});
	});

	test("only the last arg may contain the separator", () => {
		expect(customIdOf(<TwoArgs first="a" rest="b:c" style={style} />)).toBe(
			"test:two:a:b:c",
		);
		expect(() =>
			customIdOf(<TwoArgs first="a:b" rest="c" style={style} />),
		).toThrow();
	});

	test("reject ids over 100 characters", () => {
		expect(() =>
			customIdOf(<TwoArgs first="a" rest={"x".repeat(100)} style={style} />),
		).toThrow();
	});

	test("args are type-checked", () => {
		// @ts-expect-error missing args
		const missing = <TwoArgs first="a" style={style} />;
		// @ts-expect-error unexpected args
		const extra = <Plain first="a" style={style} />;
		expect([missing, extra]).toHaveLength(2);
	});

	test("arg names can't clash with element props", () => {
		defineComponent({
			id: "test:clash",
			kind: "button",
			// @ts-expect-error clashes with the button's style prop
			args: ["style"],
			handle() {},
		});
	});
});

// guards the boundary with our disjsx fork: its output must stay assignable to what discord.js accepts
describe("disjsx output", () => {
	test("is accepted by discord.js", () => {
		const message = renderDiscordMessage(
			<Message isV2>
				<TextDisplay>hi</TextDisplay>
			</Message>,
		);
		const send: MessageCreateOptions = message;
		const reply: InteractionReplyOptions = message;
		const modal: Parameters<ButtonInteraction["showModal"]>[0] =
			renderDiscordModal(
				<Modal title="Edit" customId="test:modal">
					<Label label="Content">
						<TextInput customId="content" style={TextInputStyle.Paragraph} />
					</Label>
				</Modal>,
			);
		expect([send, reply, modal]).toHaveLength(3);
	});

	test("a legacy message of only action rows still has components", () => {
		const { components } = renderDiscordMessage(
			<Message>
				<ActionRow>
					<Button
						style={ButtonStyle.Link}
						url="https://example.com"
						label="x"
					/>
				</ActionRow>
			</Message>,
		);
		const edit: MessageEditOptions = { components };
		expect(components).toHaveLength(1);
		expect(edit).toBeDefined();
	});
});
